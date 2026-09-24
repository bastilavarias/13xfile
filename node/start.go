package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/13xfile/13xfile/node/internal/node"
)

func main() {
	storage := flag.String("storage", "10GB", "storage ceiling used only on first run")
	webEnabled := flag.Bool("web", true, "run the embedded web mechanics demo")
	webListen := flag.String("web-listen", "127.0.0.1:8787", "web demo listen address; use 0.0.0.0:8787 for LAN testing")
	vaultCode := flag.String("vault-code", "", "join an existing demo vault; generated and persisted when omitted")
	flag.Parse()

	app, err := node.New()
	if err != nil {
		fail(err)
	}

	initialized, err := app.EnsureInitialized(*storage)
	if err != nil {
		fail(err)
	}
	if initialized != nil {
		fmt.Println("13xfile node initialized automatically")
		fmt.Printf("Peer ID: %s\n", initialized.PeerID)
		fmt.Printf("Storage: %s\n", initialized.StorageMax)
		fmt.Printf("Kubo:    %s\n", initialized.KuboVersion)
		fmt.Println()
	}

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	if *webEnabled {
		go func() {
			if err := app.RunWebDemo(ctx, *webListen, *vaultCode); err != nil && ctx.Err() == nil {
				fmt.Fprintln(os.Stderr, "13xfile web demo:", err)
			}
		}()
	}

	fmt.Println("Starting 13xfile node...")
	fmt.Println("Press Ctrl+C to stop.")

	if err := app.Start(ctx, true); err != nil {
		fail(err)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "13xfile-node:", err)
	os.Exit(1)
}
