package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/13xfile/13xfile/node/internal/node"
)

func main() {
	app, err := node.New()
	if err != nil {
		fail(err)
	}

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

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
