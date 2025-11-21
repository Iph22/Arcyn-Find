"use client"

import { useState } from "react"
import { Settings as SettingsIcon, User, Bell, Shield, Palette } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { EmptyState } from "@/components/empty-state"

export default function SettingsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="container mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-bold">Settings</h1>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="privacy">
                <Shield className="mr-2 h-4 w-4" />
                Privacy
              </TabsTrigger>
              <TabsTrigger value="appearance">
                <Palette className="mr-2 h-4 w-4" />
                Appearance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-semibold">Profile Settings</h2>
                <p className="text-muted-foreground">
                  Profile settings coming soon...
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-6">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-semibold">Notification Settings</h2>
                <p className="text-muted-foreground">
                  Notification settings coming soon...
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="privacy" className="mt-6">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-semibold">Privacy Settings</h2>
                <p className="text-muted-foreground">
                  Privacy settings coming soon...
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="mt-6">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-semibold">Appearance</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred theme
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

