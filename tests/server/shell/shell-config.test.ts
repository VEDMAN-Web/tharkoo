import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditEvent, Site } from "@/server/models";
import { ForbiddenError, ValidationError } from "@/server/http";
import { defaultNewDesign, ensureNewDesignSetting, newDesignOn, setNewDesign } from "@/server/site-links/new-design";
import { normaliseShellConfig, defaultShellConfig, isSafeShellHref, unsafeShellLinks, cleanShellText } from "@/server/site-links/shell-config-rules";
import { readShellConfig, saveShellConfig } from "@/server/site-links/shell-config";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const REQUEST = "req-h71";
const ACTOR = new Types.ObjectId().toString();

beforeAll(async () => {
  await connectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
  delete process.env.SITE_NOINDEX;
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("H7.1 rules: normalise and safety", () => {
  it("returns the defaults for an empty or broken stored value", () => {
    expect(normaliseShellConfig(undefined)).toEqual(defaultShellConfig());
    expect(normaliseShellConfig("nonsense")).toEqual(defaultShellConfig());
  });

  it("keeps a stored label and drops unknown topics and icons", () => {
    const config = normaliseShellConfig({
      header: { loginLabel: "Sign in", navLinks: [{ label: "Help", href: "/help/", icon: "bogus" }] },
      chat: { topics: [{ label: "Pay", topic: "not_a_topic" }, { label: "Pay now", topic: "coins_payments" }] },
    });
    expect(config.header.loginLabel).toBe("Sign in");
    expect(config.header.navLinks).toEqual([{ label: "Help", href: "/help/", visible: true, icon: "tag" }]);
    expect(config.chat.topics).toEqual([{ label: "Pay now", topic: "coins_payments" }]);
  });

  it("strips markup and control characters from text", () => {
    expect(cleanShellText("<b>Hello</b>\u0007 there")).toBe("Hello there");
  });

  it("accepts relative links and empty links, rejects script and data links", () => {
    expect(isSafeShellHref("/help/")).toBe(true);
    expect(isSafeShellHref("")).toBe(true);
    expect(isSafeShellHref("javascript:alert(1)")).toBe(false);
    expect(isSafeShellHref("data:text/html,hi")).toBe(false);
  });

  it("lists every unsafe link by field name", () => {
    const config = defaultShellConfig();
    config.footer.legal = [{ label: "Bad", href: "javascript:x", visible: true, icon: "tag" }];
    expect(unsafeShellLinks(config)).toEqual(["footer.legal: Bad"]);
  });
});

describe("H7.1 new design switch", () => {
  it("is off by default outside staging", async () => {
    expect(defaultNewDesign({})).toBe(false);
    expect(await newDesignOn()).toBe(false);
  });

  it("is on by default on the staging host (SITE_NOINDEX true) until someone saves a value", async () => {
    process.env.SITE_NOINDEX = "true";
    expect(await newDesignOn()).toBe(true);
  });

  it("superadmin turns it on and off, and each change is audited", async () => {
    await setNewDesign({ actorId: ACTOR, roles: ["superadmin"], on: true, requestId: REQUEST });
    expect(await newDesignOn()).toBe(true);
    await setNewDesign({ actorId: ACTOR, roles: ["superadmin"], on: false, requestId: REQUEST });
    expect(await newDesignOn()).toBe(false);
    const events = await AuditEvent.find({ action: "settings.new_design.update" }).sort({ _id: 1 }).lean();
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.after)).toEqual([{ newDesign: true }, { newDesign: false }]);
    expect(events[0].before).toEqual({ newDesign: false });
  });

  it("admin without superadmin is refused and nothing is written", async () => {
    await expect(setNewDesign({ actorId: ACTOR, roles: ["admin"], on: true, requestId: REQUEST })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await newDesignOn()).toBe(false);
  });

  it("refuses a body that is not a boolean", async () => {
    await expect(setNewDesign({ actorId: ACTOR, roles: ["superadmin"], on: "yes", requestId: REQUEST })).rejects.toBeInstanceOf(ValidationError);
  });

  it("migration stores the default once and never overwrites a stored value", async () => {
    process.env.SITE_NOINDEX = "true";
    await Site.create({ key: "default", name: "Tharkoo" });
    const first = await ensureNewDesignSetting(REQUEST);
    expect(first).toEqual({ updated: 1, value: true });
    await setNewDesign({ actorId: ACTOR, roles: ["superadmin"], on: false, requestId: REQUEST });
    const second = await ensureNewDesignSetting(REQUEST);
    expect(second.updated).toBe(0);
    expect(await newDesignOn()).toBe(false);
  });
});

describe("H7.1 shell config save", () => {
  it("admin saves the text and it is read back", async () => {
    const config = defaultShellConfig();
    config.chat.welcome = "Hello from admin";
    await saveShellConfig({ actorId: ACTOR, roles: ["admin"], config, requestId: REQUEST });
    expect((await readShellConfig()).chat.welcome).toBe("Hello from admin");
    const audit = await AuditEvent.findOne({ action: "settings.shell.update" }).lean();
    expect(audit).toBeTruthy();
  });

  it("a plain user cannot save", async () => {
    await expect(saveShellConfig({ actorId: ACTOR, roles: ["user"], config: defaultShellConfig(), requestId: REQUEST })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses a javascript link and writes nothing", async () => {
    const config = defaultShellConfig();
    config.footer.quickLinks = [{ label: "Bad", href: "javascript:alert(1)", visible: true, icon: "tag" }];
    await expect(saveShellConfig({ actorId: ACTOR, roles: ["admin"], config, requestId: REQUEST })).rejects.toBeInstanceOf(ValidationError);
    expect((await readShellConfig()).footer.quickLinks.some((item) => item.label === "Bad")).toBe(false);
  });
});
