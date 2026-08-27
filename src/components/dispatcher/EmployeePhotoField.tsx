"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { apiErrorMessage } from "@/lib/client-api";
import { createClient } from "@/lib/supabase/client";
import { EMPLOYEE_PHOTO_BUCKET } from "@/lib/supabase/avatar-urls";
import type { User } from "@/lib/types";

const MAXIMUM_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/**
 * The employee's photo, and the controls to set or clear it.
 *
 * Initials alone stopped being an identity the day two owners turned out to
 * share both — same letters, and the same colour, because the colour is
 * derived from the letters. A photo is the only thing that tells those two
 * rows apart at a glance.
 *
 * The bytes go straight from the browser to storage under its own policies;
 * only the resulting object key is sent to the admin route. That keeps a
 * multi-megabyte upload out of a JSON API that caps bodies at 32 KB.
 */
export function EmployeePhotoField({
  employee,
  editable,
}: {
  employee: User;
  editable: boolean;
}) {
  const { refresh } = useOperations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const savePath = async (path: string | null) => {
    const response = await fetch(`/api/admin/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatarPath: path }),
    });
    if (!response.ok)
      throw new Error(
        await apiErrorMessage(response, "The photo could not be saved."),
      );
  };

  const upload = async (file: File) => {
    if (!ACCEPTED.includes(file.type))
      throw new Error("Choose a JPEG, PNG, WEBP, or HEIC image.");
    if (file.size > MAXIMUM_BYTES)
      throw new Error("That photo is larger than 5 MB. Choose a smaller one.");
    // Filed under the employee's id: storage's policies read the folder to
    // decide who may write here, and the app reads it to decide who may look.
    const path = `${employee.id}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
    const previous = employee.avatarPath;
    const result = await createClient()
      .storage.from(EMPLOYEE_PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (result.error) throw result.error;
    try {
      await savePath(path);
    } catch (error) {
      // The profile still points at the old photo, so the new object is
      // orphaned — remove it rather than leave storage holding a file nothing
      // references.
      await createClient().storage.from(EMPLOYEE_PHOTO_BUCKET).remove([path]);
      throw error;
    }
    // Only once the profile has moved on. Deleting first would break the
    // avatar everywhere if the save then failed.
    if (previous)
      await createClient()
        .storage.from(EMPLOYEE_PHOTO_BUCKET)
        .remove([previous]);
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await upload(file);
      await refresh();
      toast("Photo updated.", { tone: "success" });
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "The photo could not be uploaded.",
        { tone: "error" },
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = async () => {
    const ok = await confirm({
      title: "Remove photo?",
      message: `${employee.fullName} goes back to showing their initials.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const path = employee.avatarPath;
    try {
      await savePath(null);
      if (path)
        await createClient().storage.from(EMPLOYEE_PHOTO_BUCKET).remove([path]);
      await refresh();
      toast("Photo removed.", { tone: "success" });
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "The photo could not be removed.",
        { tone: "error" },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar
        initials={employee.initials}
        src={employee.avatarUrl}
        alt={`${employee.fullName}'s photo`}
        size="xl"
      />
      {editable && (
        <div className="flex flex-col items-start gap-1">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy
                ? "Working…"
                : employee.avatarPath
                  ? "Replace Photo"
                  : "Add Photo"}
            </Button>
            {employee.avatarPath && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void clear()}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-brand-steel">
            JPEG, PNG, WEBP, or HEIC · up to 5 MB
          </p>
        </div>
      )}
    </div>
  );
}
