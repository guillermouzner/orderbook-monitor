/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
"use client";

import * as React from "react";
import {useTheme} from "next-themes";
import {MoonIcon} from "lucide-react";

import {Button} from "@/components/ui/button";

export function ModeToggle() {
  const {setTheme, resolvedTheme} = useTheme();

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <Button className="group/toggle size-8" size="icon" variant="secondary" onClick={toggleTheme}>
      <MoonIcon className="h-4 w-4" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
