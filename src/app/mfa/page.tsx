"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Field";
import { LogoFull } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value === "/mfa") return "/dispatcher/dashboard";
  return value;
}

type Enrollment = { factorId: string; qrCode: string; secret: string };

export default function MfaPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [factorId, setFactorId] = React.useState("");
  const [enrollment, setEnrollment] = React.useState<Enrollment | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(true);
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const prepare = async () => {
      const client = createClient();
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.data?.currentLevel === "aal2") {
        router.replace(safeInternalPath(search.get("next")));
        return;
      }
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) {
        setError("MFA could not be loaded. Sign out and try again.");
        setBusy(false);
        return;
      }
      const verified = factors.data.totp.find((factor) => factor.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setBusy(false);
        return;
      }
      const pending = factors.data.all.find((factor) => factor.factor_type === "totp" && factor.status === "unverified");
      if (pending) await client.auth.mfa.unenroll({ factorId: pending.id });
      const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "SSWSCO Administrator" });
      if (enrolled.error) {
        setError(enrolled.error.message);
      } else {
        setFactorId(enrolled.data.id);
        setEnrollment({ factorId: enrolled.data.id, qrCode: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
      }
      setBusy(false);
    };
    void prepare();
  }, [router, search]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    const client = createClient();
    const challenge = await client.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setError(challenge.error.message);
      setBusy(false);
      return;
    }
    const verified = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    if (verified.error) {
      setError("That code was not accepted. Wait for a new code and try again.");
      setBusy(false);
      return;
    }
    router.replace(safeInternalPath(search.get("next")));
    router.refresh();
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <main className="app-viewport-height safe-area-all flex items-center justify-center bg-brand-navy p-4">
      <Card className="w-full max-w-md p-7">
        <LogoFull className="mx-auto mb-5" />
        <h1 className="text-center font-heading text-2xl font-bold uppercase text-brand-charcoal">Administrator verification</h1>
        <p className="mt-2 text-center text-sm text-brand-steel">
          {enrollment ? "Scan this code once, then enter the current code." : "Enter the current code from your authenticator app."}
        </p>
        {enrollment && (
          <div className="my-5 flex flex-col items-center gap-3">
            <Image src={enrollment.qrCode} alt="Authenticator enrollment QR code" width={220} height={220} unoptimized />
            <details className="w-full text-sm text-brand-steel">
              <summary className="cursor-pointer text-center text-brand-blue">Can’t scan the code?</summary>
              <p className="mt-2 break-all rounded bg-brand-mist p-3 font-mono text-xs">{enrollment.secret}</p>
            </details>
          </div>
        )}
        <form onSubmit={verify} className="mt-5 space-y-4">
          <FormField label="Six-digit code">
            <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required autoFocus />
          </FormField>
          {error && <p role="alert" className="text-sm text-status-cancelled">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !factorId}>{busy ? "Preparing…" : "Verify and continue"}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={signOut}>Sign out</Button>
        </form>
      </Card>
    </main>
  );
}
