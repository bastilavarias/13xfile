package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"
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

	var window *application.WebviewWindow
	initialShare, _ := find13xfileURL(os.Args)

	app := application.New(application.Options{
		Name:        "13xfile",
		Description: "Decentralized encrypted file storage",
		Assets: application.AssetOptions{
			Handler:        application.BundledAssetFileServer(sub),
			DisableLogging: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "app.13xfile.desktop",
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				share, found := find13xfileURL(data.Args)
				if window == nil {
					return
				}
				window.Show()
				window.Restore()
				window.Focus()
				if found {
					window.EmitEvent("share-link", share)
				}
			},
		},
	})

	app.Event.OnApplicationEvent(events.Common.ApplicationLaunchedWithUrl, func(e *application.ApplicationEvent) {
		if window == nil {
			return
		}
		share := e.Context().URL()
		if strings.HasPrefix(share, "x13file://") || strings.HasPrefix(share, "13xfile://") {
			window.Show()
			window.Restore()
			window.Focus()
			window.EmitEvent("share-link", share)
		}
	})

	windowURL := "/"
	if initialShare != "" {
		windowURL = "/?share=" + url.QueryEscape(initialShare)
	}
	window = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "13xfile",
		Width:            1040,
		Height:           760,
		URL:              windowURL,
		EnableFileDrop:   true,
		BackgroundColour: application.NewRGB(248, 248, 247),
	})

	engine, err := newDesktopEngine(ctx, home, nodeApp)
	if err != nil {
		log.Fatal(err)
	}
	defer engine.Close()
	engine.SetAutostartHandler(func(enabled bool) error {
		if enabled {
			return app.Autostart.Enable()
		}
		return app.Autostart.Disable()
	})

	tray := newDesktopTray(app, window)
	engine.SetProgressCallback(tray.Update)

	window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		if engine.keepRunningOnClose() {
			window.Hide()
			e.Cancel()
			return
		}
		app.Quit()
	})
	window.OnWindowEvent(events.Common.WindowFilesDropped, func(event *application.WindowEvent) {
		files := event.Context().DroppedFiles()
		if len(files) == 0 {
			return
		}
		window.EmitEvent("files-dropped", map[string]any{"files": files})
	})

	go func() {
		for ctx.Err() == nil {
			err := nodeApp.Start(ctx, true)
			if ctx.Err() != nil {
				return
			}
			if err != nil {
				engine.setFatal(fmt.Errorf("node stopped: %w; restarting", err))
			} else {
				engine.setFatal(errors.New("node stopped unexpectedly; restarting"))
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(3 * time.Second):
			}
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

func find13xfileURL(args []string) (string, bool) {
	for _, arg := range args {
		arg = strings.TrimSpace(arg)
		if strings.HasPrefix(arg, "x13file://share/") || strings.HasPrefix(arg, "13xfile://share/") {
			return arg, true
		}
	}
	return "", false
}

func desktopHome() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".13xfile-desktop"), nil
}
