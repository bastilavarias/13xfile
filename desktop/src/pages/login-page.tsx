import React from "react";
import BaseLayout from "@/layouts/base/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

export default function LoginPage() {
  return (
    <BaseLayout>
      <div className="space-y-4 p-8 pt-6">
        <section className="container space-y-3">
          <Card className="border-none shadow-none">
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Username</Label>
                <Input id="email" type="email" placeholder="000001" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Login</Button>
            </CardFooter>
            <CardContent>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card text-muted-foreground px-2">
                    Or continue with
                  </span>
                </div>
              </div>
            </CardContent>
            <CardContent className="grid gap-4">
              <Button variant="outline">
                <Upload />
                Upload Passphrase
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </BaseLayout>
  );
}
