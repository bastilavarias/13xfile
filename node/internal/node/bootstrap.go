package node

import (
	"archive/tar"
	"archive/zip"
	"bufio"
	"compress/gzip"
	"context"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const managedKuboVersion = "0.43.1"

var httpClient = &http.Client{Timeout: 5 * time.Minute}

func managedKuboPath(home string) string {
	name := "ipfs"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return filepath.Join(home, "runtime", "kubo", managedKuboVersion, name)
}

func ensureManagedKubo(ctx context.Context, home string) (string, error) {
	if explicit := strings.TrimSpace(os.Getenv("KUBO_BIN")); explicit != "" {
		if err := validateExecutable(explicit); err != nil {
			return "", fmt.Errorf("KUBO_BIN %q is not usable: %w", explicit, err)
		}
		return explicit, nil
	}

	managed := managedKuboPath(home)
	if err := validateExecutable(managed); err == nil {
		return managed, nil
	}

	archiveName, archiveKind, err := kuboArchive(runtime.GOOS, runtime.GOARCH)
	if err != nil {
		return "", err
	}

	baseURL := fmt.Sprintf(
		"https://github.com/ipfs/kubo/releases/download/v%s/%s",
		managedKuboVersion,
		archiveName,
	)

	runtimeDir := filepath.Dir(managed)
	if err := os.MkdirAll(runtimeDir, 0o700); err != nil {
		return "", fmt.Errorf("create managed Kubo runtime directory: %w", err)
	}

	tmpDir, err := os.MkdirTemp(runtimeDir, ".download-*")
	if err != nil {
		return "", fmt.Errorf("create Kubo download directory: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	archivePath := filepath.Join(tmpDir, archiveName)
	checksumPath := archivePath + ".sha512"

	if err := downloadFile(ctx, baseURL, archivePath); err != nil {
		return "", fmt.Errorf("download Kubo %s: %w", managedKuboVersion, err)
	}
	if err := downloadFile(ctx, baseURL+".sha512", checksumPath); err != nil {
		return "", fmt.Errorf("download Kubo checksum: %w", err)
	}

	if err := verifySHA512(archivePath, checksumPath); err != nil {
		return "", fmt.Errorf("verify Kubo download: %w", err)
	}

	switch archiveKind {
	case "zip":
		err = extractKuboZip(archivePath, managed)
	case "tar.gz":
		err = extractKuboTarGz(archivePath, managed)
	default:
		err = fmt.Errorf("unsupported archive kind %q", archiveKind)
	}
	if err != nil {
		return "", err
	}

	if err := os.Chmod(managed, 0o700); err != nil && runtime.GOOS != "windows" {
		return "", fmt.Errorf("mark managed Kubo executable: %w", err)
	}
	if err := validateExecutable(managed); err != nil {
		return "", fmt.Errorf("managed Kubo validation failed: %w", err)
	}

	return managed, nil
}

func kuboArchive(goos, goarch string) (name, kind string, err error) {
	switch goos {
	case "windows":
		if goarch != "amd64" && goarch != "arm64" {
			return "", "", fmt.Errorf("unsupported Windows architecture %s", goarch)
		}
		return fmt.Sprintf("kubo_v%s_windows-%s.zip", managedKuboVersion, goarch), "zip", nil
	case "linux":
		if goarch != "amd64" && goarch != "arm64" {
			return "", "", fmt.Errorf("unsupported Linux architecture %s", goarch)
		}
		return fmt.Sprintf("kubo_v%s_linux-%s.tar.gz", managedKuboVersion, goarch), "tar.gz", nil
	case "darwin":
		if goarch != "amd64" && goarch != "arm64" {
			return "", "", fmt.Errorf("unsupported macOS architecture %s", goarch)
		}
		return fmt.Sprintf("kubo_v%s_darwin-%s.tar.gz", managedKuboVersion, goarch), "tar.gz", nil
	default:
		return "", "", fmt.Errorf("automatic Kubo bootstrap is not supported on %s/%s", goos, goarch)
	}
}

func validateExecutable(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return errors.New("path is a directory")
	}
	return nil
}

func downloadFile(ctx context.Context, url, destination string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %s", resp.Status)
	}

	out, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		return err
	}
	return out.Sync()
}

func verifySHA512(archivePath, checksumPath string) error {
	checksumFile, err := os.Open(checksumPath)
	if err != nil {
		return err
	}
	defer checksumFile.Close()

	scanner := bufio.NewScanner(checksumFile)
	if !scanner.Scan() {
		if err := scanner.Err(); err != nil {
			return err
		}
		return errors.New("empty checksum file")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 1 {
		return errors.New("invalid checksum file")
	}
	expected := strings.ToLower(fields[0])
	if len(expected) != sha512.Size*2 {
		return errors.New("invalid SHA-512 checksum length")
	}

	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	hash := sha512.New()
	if _, err := io.Copy(hash, file); err != nil {
		return err
	}
	actual := hex.EncodeToString(hash.Sum(nil))
	if actual != expected {
		return fmt.Errorf("SHA-512 mismatch: expected %s, got %s", expected, actual)
	}
	return nil
}

func extractKuboZip(archivePath, destination string) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("open Kubo zip: %w", err)
	}
	defer reader.Close()

	targetName := "kubo/ipfs.exe"
	for _, entry := range reader.File {
		if filepath.ToSlash(entry.Name) != targetName {
			continue
		}
		source, err := entry.Open()
		if err != nil {
			return err
		}
		defer source.Close()
		return writeExecutable(destination, source)
	}
	return fmt.Errorf("%s not found in Kubo archive", targetName)
}

func extractKuboTarGz(archivePath, destination string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	gz, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("open Kubo gzip: %w", err)
	}
	defer gz.Close()

	reader := tar.NewReader(gz)
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("read Kubo tar: %w", err)
		}
		if filepath.ToSlash(header.Name) == "kubo/ipfs" {
			return writeExecutable(destination, reader)
		}
	}
	return errors.New("kubo/ipfs not found in Kubo archive")
}

func writeExecutable(destination string, source io.Reader) error {
	tmp := destination + ".tmp"
	out, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o700)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, source)
	closeErr := out.Close()
	if copyErr != nil {
		_ = os.Remove(tmp)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}
	if err := os.Rename(tmp, destination); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}
