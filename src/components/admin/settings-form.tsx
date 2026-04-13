"use client";

import { useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, Upload, Image as ImageIcon, Copy, Check } from "lucide-react";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border border-input bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1"
        />
      </div>
    </div>
  );
}

export function SettingsForm() {
  const { settings, loading, updateSettings } = useSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      setForm({ ...settings });
    }
  }, [loading, settings]);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setField("logo_url", data.url);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const changed: Record<string, string> = {};
    for (const [key, value] of Object.entries(form)) {
      if (value !== settings[key]) {
        changed[key] = value;
      }
    }

    if (Object.keys(changed).length === 0) return;

    setSaving(true);
    try {
      await updateSettings(changed);
    } finally {
      setSaving(false);
    }
  }

  function getEmbedCode() {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
    return `<iframe
  src="${origin}/chart"
  width="100%"
  height="800"
  style="border: none; border-radius: 8px;"
  title="${form.chart_title || "Organization Chart"}"
></iframe>`;
  }

  async function handleCopyEmbed() {
    await navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <p className="text-rs-neutral-400">Loading settings...</p>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your organization chart branding and appearance.
        </p>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Basic information displayed on the chart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org_name">Organization Name</Label>
            <Input
              id="org_name"
              value={form.org_name || ""}
              onChange={(e) => setField("org_name", e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chart_title">Chart Title</Label>
            <Input
              id="chart_title"
              value={form.chart_title || ""}
              onChange={(e) => setField("chart_title", e.target.value)}
              placeholder="Organization Chart"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={form.tagline || ""}
              onChange={(e) => setField("tagline", e.target.value)}
              placeholder="Building the future together"
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Upload a logo to display on the chart header.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <NextImage
                src={form.logo_url}
                alt="Logo"
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg object-cover border border-input"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg border border-dashed border-input flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Logo"}
              </Button>
              {form.logo_url && (
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">
                  {form.logo_url}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
          <CardDescription>
            Customize the chart color scheme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ColorField
            label="Primary Color"
            value={form.color_primary || "#0070E0"}
            onChange={(v) => setField("color_primary", v)}
          />
          <ColorField
            label="Accent Color"
            value={form.color_accent || "#7C3AED"}
            onChange={(v) => setField("color_accent", v)}
          />
          <ColorField
            label="Neutral Color"
            value={form.color_neutral || "#6B7280"}
            onChange={(v) => setField("color_neutral", v)}
          />
        </CardContent>
      </Card>

      {/* Embed Code */}
      <Card>
        <CardHeader>
          <CardTitle>Embed Code</CardTitle>
          <CardDescription>
            Copy this snippet to embed the chart on any website.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="bg-rs-neutral-900 border border-rs-neutral-800 rounded-lg p-4 text-xs text-rs-neutral-300 overflow-x-auto whitespace-pre-wrap">
              {getEmbedCode()}
            </pre>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleCopyEmbed}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
