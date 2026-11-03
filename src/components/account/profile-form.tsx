"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormFeedback, useFormText } from "@/components/auth/form-feedback";
import { describedBy, FieldShell, inputClasses, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfile } from "@/lib/account/settings-actions";
import { initialFormState } from "@/lib/auth/form-state";

type Props = {
  profile: { displayName: string; username: string; cityId: number | null; bio: string };
  cities: { id: number; name: string }[];
};

/** Perfil público (ALCANCE §4.3): nombre, usuario, ciudad y descripción. */
export function ProfileForm({ profile, cities }: Props) {
  const t = useTranslations("settings.profile");
  const text = useFormText();
  const [state, action] = useActionState(updateProfile, initialFormState);
  const values = state.values ?? {
    displayName: profile.displayName,
    username: profile.username,
    cityId: profile.cityId === null ? "" : String(profile.cityId),
    bio: profile.bio,
  };
  const errors = state.fieldErrors ?? {};
  const cityError = text.error(errors.cityId);
  const bioError = text.error(errors.bio);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} />
      <TextField
        id="profile-name"
        name="displayName"
        label={t("displayName")}
        hint={t("displayNameHint")}
        error={text.error(errors.displayName)}
        autoComplete="name"
        maxLength={50}
        required
        defaultValue={values.displayName}
      />
      <TextField
        id="profile-username"
        name="username"
        label={t("username")}
        hint={t("usernameHint", { username: values.username || profile.username })}
        error={text.error(errors.username)}
        prefix="@"
        autoCapitalize="none"
        autoComplete="username"
        spellCheck={false}
        maxLength={20}
        required
        defaultValue={values.username}
      />
      <FieldShell id="profile-city" label={t("city")} error={cityError}>
        <select
          id="profile-city"
          name="cityId"
          defaultValue={values.cityId}
          aria-invalid={cityError ? true : undefined}
          aria-describedby={describedBy("profile-city", undefined, cityError)}
          className={inputClasses()}
        >
          <option value="">{t("cityNone")}</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </FieldShell>
      <FieldShell id="profile-bio" label={t("bio")} hint={t("bioHint")} error={bioError}>
        <textarea
          id="profile-bio"
          name="bio"
          rows={3}
          maxLength={300}
          defaultValue={values.bio}
          aria-invalid={bioError ? true : undefined}
          aria-describedby={describedBy("profile-bio", t("bioHint"), bioError)}
          className={inputClasses("py-3 leading-relaxed")}
        />
      </FieldShell>
      <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
    </form>
  );
}
