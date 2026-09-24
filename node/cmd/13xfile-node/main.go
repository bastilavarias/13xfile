package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/13xfile/13xfile/node/internal/node"
)

const version = "0.2.0-dev"

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "13xfile-node:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage()
		return nil
	}

	app, err := node.New()
	if err != nil {
		return err
	}

	switch args[0] {
	case "help", "-h", "--help":
		printUsage()
		return nil
	case "version":
		fmt.Printf("13xfile-node %s\n", version)
		return nil
	case "init":
		fs := flag.NewFlagSet("init", flag.ContinueOnError)
		storage := fs.String("storage", "100GB", "maximum Kubo repository storage before GC")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 0 {
			return errors.New("init accepts no positional arguments")
		}
		result, err := app.Init(*storage)
		if err != nil {
			return err
		}
		fmt.Println("13xfile node initialized")
		fmt.Printf("Peer ID:  %s\n", result.PeerID)
		fmt.Printf("Repo:     %s\n", result.RepoPath)
		fmt.Printf("Storage:  %s\n", result.StorageMax)
		fmt.Printf("Kubo:     %s\n", result.KuboVersion)
		fmt.Println("\nNext: 13xfile-node start")
		return nil
	case "start":
		fs := flag.NewFlagSet("start", flag.ContinueOnError)
		enableGC := fs.Bool("gc", true, "enable automatic Kubo garbage collection")
		storage := fs.String("storage", "10GB", "storage ceiling used only on first run")
		webEnabled := fs.Bool("web", true, "run the embedded web mechanics demo")
		webListen := fs.String("web-listen", "127.0.0.1:8787", "web demo listen address; use 0.0.0.0:8787 for LAN testing")
		vaultCode := fs.String("vault-code", "", "join an existing demo vault; generated and persisted when omitted")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 0 {
			return errors.New("start accepts no positional arguments")
		}
		if initialized, err := app.EnsureInitialized(*storage); err != nil {
			return err
		} else if initialized != nil {
			fmt.Println("13xfile node initialized automatically")
			fmt.Printf("Peer ID:  %s\n", initialized.PeerID)
			fmt.Printf("Storage:  %s\n", initialized.StorageMax)
			fmt.Printf("Kubo:     %s\n", initialized.KuboVersion)
		}
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		if *webEnabled {
			go func() {
				if err := app.RunWebDemo(ctx, *webListen, *vaultCode); err != nil && ctx.Err() == nil {
					fmt.Fprintln(os.Stderr, "13xfile web demo:", err)
				}
			}()
		}
		fmt.Println("Starting 13xfile storage peer...")
		return app.Start(ctx, *enableGC)
	case "status":
		status, err := app.Status()
		if err != nil {
			return err
		}
		fmt.Println("13xfile node")
		fmt.Printf("Peer ID:       %s\n", status.PeerID)
		fmt.Printf("Online:        %t\n", status.Online)
		fmt.Printf("Connected:     %d peers\n", status.ConnectedPeers)
		fmt.Printf("Repo:          %s\n", status.RepoPath)
		fmt.Printf("Storage max:   %s\n", status.StorageMax)
		if status.RepoStat != "" {
			fmt.Println("Repo stats:")
			for _, line := range strings.Split(strings.TrimSpace(status.RepoStat), "\n") {
				fmt.Printf("  %s\n", line)
			}
		}
		return nil
	case "pin":
		if len(args) != 2 {
			return errors.New("usage: 13xfile-node pin <cid-or-ipfs-path>")
		}
		result, err := app.Pin(args[1])
		if err != nil {
			return err
		}
		fmt.Printf("Pinned %s\n", result)
		return nil
	case "unpin":
		if len(args) != 2 {
			return errors.New("usage: 13xfile-node unpin <cid-or-ipfs-path>")
		}
		result, err := app.Unpin(args[1])
		if err != nil {
			return err
		}
		fmt.Printf("Unpinned %s\n", result)
		return nil
	case "peers":
		peers, err := app.Peers()
		if err != nil {
			return err
		}
		if len(peers) == 0 {
			fmt.Println("No connected peers.")
			return nil
		}
		for _, peer := range peers {
			fmt.Println(peer)
		}
		return nil
	case "gc":
		start := time.Now()
		output, err := app.GC()
		if err != nil {
			return err
		}
		if strings.TrimSpace(output) != "" {
			fmt.Print(output)
			if !strings.HasSuffix(output, "\n") {
				fmt.Println()
			}
		}
		fmt.Printf("GC finished in %s\n", time.Since(start).Round(time.Millisecond))
		return nil
	case "doctor":
		report := app.Doctor()
		fmt.Printf("Kubo binary:  %s\n", report.KuboBinary)
		fmt.Printf("Kubo works:   %t\n", report.KuboAvailable)
		if report.KuboVersion != "" {
			fmt.Printf("Kubo version: %s\n", report.KuboVersion)
		}
		fmt.Printf("Node config:  %t\n", report.ConfigPresent)
		fmt.Printf("IPFS repo:    %t\n", report.RepoPresent)
		if report.Error != "" {
			return errors.New(report.Error)
		}
		return nil
	default:
		printUsage()
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func printUsage() {
	fmt.Print(`13xfile-node v0.2

Headless storage peer for the 13xfile network.

Usage:
  13xfile-node init [--storage 100GB]
  13xfile-node start [--storage 10GB] [--gc=true] [--web=true] [--web-listen 127.0.0.1:8787] [--vault-code CODE]
  13xfile-node status
  13xfile-node pin <cid-or-ipfs-path>
  13xfile-node unpin <cid-or-ipfs-path>
  13xfile-node peers
  13xfile-node gc
  13xfile-node doctor
  13xfile-node version

Environment:
  THIRTEENXFILE_NODE_HOME  Override node state directory
  KUBO_BIN                 Override path to Kubo's ipfs executable
`)
}
