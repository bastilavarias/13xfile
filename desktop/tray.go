package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
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
	tray.SetIcon(progressTrayIcon(0, false))
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
		t.tray.SetIcon(progressTrayIcon(progress, true))
		t.tray.SetTooltip(fmt.Sprintf("13xfile — %d transfer(s) · %d%%", active, progress))
		t.transferItem.SetLabel(fmt.Sprintf("%d transfer(s) · %d%%", active, progress))
	} else {
		t.tray.SetIcon(progressTrayIcon(100, false))
		t.tray.SetTooltip("13xfile — Node online")
		t.transferItem.SetLabel("No active transfers")
	}
	t.statusItem.SetLabel("Node online")
	t.menu.Update()
}

func progressTrayIcon(progress int, active bool) []byte {
	if progress < 0 {
		progress = 0
	}
	if progress > 100 {
		progress = 100
	}

	img := image.NewRGBA(image.Rect(0, 0, 32, 32))
	dark := color.RGBA{24, 24, 24, 255}
	light := color.RGBA{250, 250, 250, 255}
	muted := color.RGBA{120, 120, 120, 255}

	for y := 4; y < 28; y++ {
		for x := 4; x < 28; x++ {
			dx, dy := x-16, y-16
			if dx*dx+dy*dy <= 144 {
				img.Set(x, y, dark)
			}
		}
	}
	for x := 10; x <= 12; x++ {
		for y := 9; y <= 20; y++ {
			img.Set(x, y, light)
		}
	}
	for x := 17; x <= 22; x++ {
		img.Set(x, 9, light)
		img.Set(x, 14, light)
		img.Set(x, 20, light)
	}
	for y := 10; y < 14; y++ {
		img.Set(22, y, light)
	}
	for y := 15; y < 20; y++ {
		img.Set(22, y, light)
	}

	for x := 6; x < 26; x++ {
		img.Set(x, 25, muted)
	}
	if active {
		width := 20 * progress / 100
		for x := 6; x < 6+width; x++ {
			img.Set(x, 25, light)
		}
	}

	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}
