"use client";

import { ArrowRight, ImageIcon, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { googleLoginURL, imagenApi } from "@/lib/api";

export default function LoginPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [loginURL, setLoginURL] = useState("#");

  useEffect(() => {
    let mounted = true;
    setLoginURL(googleLoginURL("/admin"));
    imagenApi
      .me()
      .then((me) => {
        if (!mounted) {
          return;
        }
        if (me.authenticated) {
          window.location.href = "/admin";
          return;
        }
        if (me.google_configured === false) {
          setMessage("后端尚未配置 Google OAuth。");
        }
      })
      .catch((error: Error) => {
        if (mounted) {
          setMessage(error.message);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Imagen</h1>
            <p className="text-sm text-surface-400">生图控制台</p>
          </div>
        </div>

        <Card className="border-white/10 bg-surface-900/75">
          <CardContent className="p-6">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">登录管理后台</h2>
            <p className="mt-2 text-sm leading-6 text-surface-400">
              使用允许的 Google 账号登录后，可以管理 API 密钥、引擎账号和生成任务。
            </p>

            {message ? (
              <div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {message}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              <a
                href="/client/"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition-all hover:bg-white/10"
              >
                打开客户端
              </a>
              <a
                href={loginURL}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              >
                使用 Google 登录
                <ArrowRight className="h-4 w-4" />
              </a>
              <button
                type="button"
                disabled={loading}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition-all disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                检查登录状态
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
