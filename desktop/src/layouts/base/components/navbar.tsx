import React from "react";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { toggleTheme } from "@/helpers/theme_helpers";
import { Moon, Sun } from "lucide-react";

export default function Navbar() {
  return (
    <Menubar className="rounded-none border-t-0 shadow-none">
      <MenubarMenu>
        <MenubarTrigger className="font-bold">App</MenubarTrigger>
        <MenubarSeparator />
        <MenubarContent>
          <MenubarItem>About 13xFile</MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Theme</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={toggleTheme}>
                <Sun />
                Light
              </MenubarItem>
              <MenubarItem onClick={toggleTheme}>
                <Moon />
                Dark
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem>
            Quit 13xFile <MenubarShortcut>⌘Esc</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
