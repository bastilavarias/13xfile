import React from "react";
import BaseLayout from "@/layouts/base/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VenetianMask } from "lucide-react";

export default function RegisterPage() {
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
              <div className="grid gap-2">
                <Label htmlFor="password">Confirm Password</Label>
                <Input id="password" type="password" />
              </div>
              <Alert>
                <VenetianMask className="h-4 w-4" />
                <AlertTitle>Remain anonymous...</AlertTitle>
                <AlertDescription>
                  Registering is completely optional and is only used to index
                  your uploaded files on the network. If you don’t need to track
                  or manage your files, you can skip registration. <br />{" "}
                  However, if you choose to register, the platform will generate
                  a unique passphrase for you. This passphrase is the only way
                  to recover and manage your uploaded files—so keep it safe! 🔐{" "}
                  <br />
                  <span className="inline font-semibold italic">
                    ⚠️ We do not store any of your personal information. Your
                    data stays private, and only you have access to your files.
                  </span>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Register</Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </BaseLayout>
  );
}
