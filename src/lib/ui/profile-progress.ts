export type ProfileStep = { key: string; label: string; href: string; done: boolean };

export type ProfileInput = {
  hasProfile: boolean;
  emailVerified: boolean;
  whatsapp: boolean;
  idChecked: boolean;
  hasAd: boolean;
  liveChat: boolean;
};

export function profileSteps(input: ProfileInput): ProfileStep[] {
  return [
    { key: "about", label: "Add your name and city", href: "/u/seller-profile/", done: input.hasProfile },
    { key: "email", label: "Verify your email", href: "/u/account/edit-account/", done: input.emailVerified },
    { key: "whatsapp", label: "Add your WhatsApp number", href: "/u/seller-profile/", done: input.whatsapp },
    { key: "id", label: "Check your ID", href: "/u/account/kyc/", done: input.idChecked },
    { key: "ad", label: "Post your first ad", href: "/u/post-insert/", done: input.hasAd },
    { key: "chat", label: "Turn on live chat", href: "/u/account/edit-account/", done: input.liveChat },
  ];
}

export function profileProgress(input: ProfileInput): { percent: number; missing: ProfileStep[] } {
  const steps = profileSteps(input);
  const done = steps.filter((step) => step.done).length;
  return { percent: Math.round((done / steps.length) * 100), missing: steps.filter((step) => !step.done).slice(0, 3) };
}
