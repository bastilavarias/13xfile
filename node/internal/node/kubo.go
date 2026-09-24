package node

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

type kubo struct {
	binary   string
	repoPath string
}

func findKuboBinary(home string) (string, error) {
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

	path, err := exec.LookPath("ipfs")
	if err != nil {
		return "", errors.New("Kubo executable not found")
	}
	return path, nil
}

func (k kubo) command(ctx context.Context, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, k.binary, args...)
	cmd.Env = append(os.Environ(), "IPFS_PATH="+k.repoPath)
	return cmd
}

func (k kubo) run(ctx context.Context, args ...string) (string, error) {
	cmd := k.command(ctx, args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return "", fmt.Errorf("ipfs %s: %s", strings.Join(args, " "), message)
	}
	return strings.TrimSpace(stdout.String()), nil
}

func (k kubo) daemon(ctx context.Context, enableGC bool) error {
	args := []string{"daemon"}
	if enableGC {
		args = append(args, "--enable-gc")
	}

	cmd := k.command(context.Background(), args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start Kubo daemon: %w", err)
	}

	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("Kubo daemon exited: %w", err)
		}
		return nil
	case <-ctx.Done():
		if cmd.Process == nil {
			return ctx.Err()
		}

		_ = cmd.Process.Signal(syscall.SIGTERM)
		select {
		case err := <-done:
			if err != nil {
				var exitErr *exec.ExitError
				if errors.As(err, &exitErr) && exitErr.ExitCode() == -1 {
					return nil
				}
			}
			return nil
		case <-time.After(10 * time.Second):
			_ = cmd.Process.Kill()
			<-done
			return nil
		}
	}
}

func repoExists(repoPath string) bool {
	info, err := os.Stat(filepath.Join(repoPath, "config"))
	return err == nil && !info.IsDir()
}
