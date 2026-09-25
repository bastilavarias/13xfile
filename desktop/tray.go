package main

import (
	"encoding/base64"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type DesktopTray struct {
	tray         *application.SystemTray
	menu         *application.Menu
	statusItem   *application.MenuItem
	transferItem *application.MenuItem
	mu           sync.Mutex
}

func newDesktopTray(app *application.App, window *application.WebviewWindow) *DesktopTray {
	tray := app.SystemTray.New()
	tray.SetIcon(brandTrayIcon())
	tray.SetDarkModeIcon(brandTrayIcon())
	tray.SetTooltip("13xfile — starting")

	menu := app.NewMenu()
	menu.Add("Open 13xfile").OnClick(func(_ *application.Context) {
		window.Show()
		window.Focus()
	})
	statusItem := menu.Add("Node starting…").SetEnabled(false)
	transferItem := menu.Add("No active transfers").SetEnabled(false)
	menu.AddSeparator()
	menu.Add("Quit 13xfile").OnClick(func(_ *application.Context) { app.Quit() })
	tray.SetMenu(menu)
	tray.OnClick(func() {
		if window.IsVisible() {
			window.Hide()
		} else {
			window.Show()
			window.Focus()
		}
	})

	return &DesktopTray{tray: tray, menu: menu, statusItem: statusItem, transferItem: transferItem}
}

func (t *DesktopTray) Update(active int, progress int, summary string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if active > 0 {
		t.tray.SetIcon(brandTrayIcon())
		t.tray.SetDarkModeIcon(brandTrayIcon())
		t.tray.SetTooltip(fmt.Sprintf("13xfile — %d transfer(s) · %d%%", active, progress))
		t.transferItem.SetLabel(fmt.Sprintf("%d transfer(s) · %d%%", active, progress))
	} else {
		t.tray.SetIcon(brandTrayIcon())
		t.tray.SetDarkModeIcon(brandTrayIcon())
		t.tray.SetTooltip("13xfile — Node online")
		t.transferItem.SetLabel("No active transfers")
	}
	t.statusItem.SetLabel("Node online")
	t.menu.Update()
}

var (
	trayIconOnce sync.Once
	trayIconData []byte
)

func brandTrayIcon() []byte {
	trayIconOnce.Do(func() {
		trayIconData, _ = base64.StdEncoding.DecodeString(trayEmblemBase64)
	})
	return trayIconData
}

// Approved compact 13x emblem, pre-sized for system tray rendering.
const trayEmblemBase64 = "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"
