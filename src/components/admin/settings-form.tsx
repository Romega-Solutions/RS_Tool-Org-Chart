"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import NextImage from "next/image";
import { toast } from "sonner";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Save,
  Upload,
  Image as ImageIcon,
  Copy,
  Check,
  Building,
  Palette,
  Code2,
  X,
  Loader2,
  Settings,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Color field                                                        */
/* ------------------------------------------------------------------ */

interface ColorFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ label, description, value, onChange }: ColorFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex gap-2 items-center">
        {/* Hidden native picker */}
        <input
          ref={pickerRef}
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
        {/* Custom swatch */}
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          className="w-10 h-10 rounded-lg cursor-pointer border-2 border-border hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ backgroundColor: value || "#000000" }}
          title="Pick color"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 font-mono text-sm"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-32 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-border p-6 space-y-4">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-4 w-56 bg-muted rounded" />
          <div className="space-y-3">
            <div className="h-10 w-full bg-muted rounded" />
            <div className="h-10 w-full bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main form                                                          */
/* ------------------------------------------------------------------ */

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

  // Track unsaved changes
  const hasChanges = useMemo(() => {
    if (loading) return false;
    return Object.entries(form).some(
      ([key, value]) => value !== settings[key]
    );
  }, [form, settings, loading]);

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
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setField("logo_url", data.url);
        toast.success("Logo uploaded successfully");
      }
    } catch {
      toast.error("Failed to upload logo");
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
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function getEmbedCode() {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://your-domain.com";
    return `<iframe\n  src="${origin}/chart"\n  width="100%"\n  height="800"\n  style="border: none; border-radius: 8px;"\n  title="${form.chart_title || "Organization Chart"}"\n></iframe>`;
  }

  async function handleCopyEmbed() {
    await navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    toast.success("Embed code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-3xl pb-20">
      {/* Page heading */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your organization chart branding and appearance.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rs-primary-500/10 flex items-center justify-center shrink-0">
              <Building className="w-4.5 h-4.5 text-rs-primary-400" />
            </div>
            <div>
              <CardTitle className="text-base">Organization</CardTitle>
              <CardDescription>
                Basic information displayed on the chart header.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org_name">Organization Name</Label>
            <Input
              id="org_name"
              value={form.org_name || ""}
              onChange={(e) => setField("org_name", e.target.value)}
              placeholder="Acme Corp"
            />
            <p className="text-xs text-muted-foreground">
              Displayed in the chart title and embed metadata.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="chart_title">Chart Title</Label>
              <Input
                id="chart_title"
                value={form.chart_title || ""}
                onChange={(e) => setField("chart_title", e.target.value)}
                placeholder="Organization Chart"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={form.tagline || ""}
                onChange={(e) => setField("tagline", e.target.value)}
                placeholder="Building the future together"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rs-accent-500/10 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4.5 h-4.5 text-rs-accent-400" />
            </div>
            <div>
              <CardTitle className="text-base">Logo</CardTitle>
              <CardDescription>
                Displayed on the chart header. Recommended: SVG or PNG with
                transparent background.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            {/* Preview */}
            <div className="relative group">
              {form.logo_url ? (
                <div className="relative">
                  <NextImage
                    src={form.logo_url}
                    alt="Logo"
                    width={80}
                    height={80}
                    className="w-20 h-20 rounded-xl object-contain border border-border bg-muted/30 p-2"
                  />
                  <button
                    type="button"
                    onClick={() => setField("logo_url", "")}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Remove logo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-rs-primary-400/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    Upload
                  </span>
                </div>
              )}
            </div>
            {/* Upload control */}
            <div className="flex-1 space-y-2">
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
                className="cursor-pointer transition-all duration-200"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {uploading ? "Uploading..." : "Choose File"}
              </Button>
              <p className="text-xs text-muted-foreground">
                SVG, PNG or JPG. Max 2MB.
              </p>
              {form.logo_url && (
                <p className="text-xs text-muted-foreground truncate max-w-xs font-mono">
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
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <Palette className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base">Brand Colors</CardTitle>
              <CardDescription>
                Customize the chart color scheme. Changes are reflected on the
                chart nodes and header.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Color preview */}
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-lg border border-border shadow-sm"
              style={{
                backgroundColor: form.color_primary || "#0070E0",
              }}
              title="Primary"
            />
            <div
              className="w-10 h-10 rounded-lg border border-border shadow-sm"
              style={{
                backgroundColor: form.color_accent || "#7C3AED",
              }}
              title="Accent"
            />
            <div
              className="w-10 h-10 rounded-lg border border-border shadow-sm"
              style={{
                backgroundColor: form.color_neutral || "#6B7280",
              }}
              title="Neutral"
            />
            <span className="text-xs text-muted-foreground ml-2">
              Live preview
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField
              label="Primary"
              description="Main brand color for headings and links."
              value={form.color_primary || "#0070E0"}
              onChange={(v) => setField("color_primary", v)}
            />
            <ColorField
              label="Accent"
              description="Highlight and call-to-action elements."
              value={form.color_accent || "#7C3AED"}
              onChange={(v) => setField("color_accent", v)}
            />
            <ColorField
              label="Neutral"
              description="Borders, muted text and backgrounds."
              value={form.color_neutral || "#6B7280"}
              onChange={(v) => setField("color_neutral", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Embed Code */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Code2 className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-base">Embed Code</CardTitle>
              <CardDescription>
                Copy this snippet to embed the chart on any website.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="bg-muted/50 border border-border rounded-lg p-4 pr-12 text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap">
              {getEmbedCode()}
            </pre>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 cursor-pointer transition-all duration-200 h-8 w-8"
              onClick={handleCopyEmbed}
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto px-6 py-3">
          <p className="text-sm text-muted-foreground">
            {hasChanges ? (
              <span className="text-rs-accent-400 font-medium">
                You have unsaved changes
              </span>
            ) : (
              "All changes saved"
            )}
          </p>
          <Button
            type="submit"
            disabled={saving || !hasChanges}
            className="cursor-pointer transition-all duration-200"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </form>
  );
}
