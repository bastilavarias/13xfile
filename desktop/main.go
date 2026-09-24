package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"time"

	nodeengine "github.com/13xfile/13xfile/node/internal/node"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed frontend/dist/*
var frontendAssets embed.FS

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	home, err := desktopHome()
	if err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(home, 0o700); err != nil {
		log.Fatal(err)
	}
	if err := os.Setenv("THIRTEENXFILE_NODE_HOME", filepath.Join(home, "node")); err != nil {
		log.Fatal(err)
	}

	nodeApp, err := nodeengine.New()
	if err != nil {
		log.Fatal(err)
	}
	if _, err := nodeApp.EnsureInitialized("20GB"); err != nil {
		log.Fatal(err)
	}

	sub, err := fs.Sub(frontendAssets, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	app := application.New(application.Options{
		Name:        "13xfile",
		Description: "Decentralized file storage prototype",
		Assets: application.AssetOptions{
			Handler:        application.BundledAssetFileServer(sub),
			DisableLogging: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "app.13xfile.desktop.prototype",
		},
	})

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "13xfile",
		Width:            1040,
		Height:           760,
		URL:              "/",
		EnableFileDrop:   true,
		BackgroundColour: application.NewRGB(248, 248, 247),
	})

	engine, err := newDesktopEngine(ctx, home, nodeApp)
	if err != nil {
		log.Fatal(err)
	}
	defer engine.Close()

	tray := newDesktopTray(app, window)
	engine.SetProgressCallback(tray.Update)

	window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		window.Hide()
		e.Cancel()
	})
	window.OnWindowEvent(events.Common.WindowFilesDropped, func(event *application.WindowEvent) {
		files := event.Context().DroppedFiles()
		if len(files) == 0 {
			return
		}
		window.EmitEvent("files-dropped", map[string]any{"files": files})
	})

	go func() {
		if err := nodeApp.Start(ctx, true); err != nil && ctx.Err() == nil {
			engine.setFatal(fmt.Errorf("node stopped: %w", err))
			return
		}
	}()

	go engine.Run()

	go func() {
		for ctx.Err() == nil {
			status, err := nodeApp.Status()
			if err == nil {
				engine.setPeerStatus(status.Online, status.ConnectedPeers, status.PeerID)
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(10 * time.Second):
			}
		}
	}()

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
	cancel()
}

func desktopHome() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".13xfile-desktop"), nil
}
