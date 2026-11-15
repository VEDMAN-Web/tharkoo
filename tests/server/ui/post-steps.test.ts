import { describe, expect, it } from "vitest";
import { NEW_POST_STEPS, draftToForm, errorsForStep, stepOfError, validatePost } from "@/lib/ui/post-form";

describe("New design post-ad steps (H7.5)", () => {
  it("has the five steps in order", () => {
    expect(NEW_POST_STEPS).toEqual(["category", "details", "photos", "contact", "review"]);
  });

  it("maps each validation key to the step that shows it", () => {
    expect(stepOfError("category")).toBe("category");
    expect(stepOfError("subcategory")).toBe("category");
    expect(stepOfError("city")).toBe("details");
    expect(stepOfError("title")).toBe("details");
    expect(stepOfError("price")).toBe("details");
    expect(stepOfError("some-category-field")).toBe("details");
    expect(stepOfError("phone")).toBe("contact");
    expect(stepOfError("terms")).toBe("review");
    expect(stepOfError("adult")).toBe("review");
  });

  it("returns only the errors a step owns, so a later step cannot block an earlier one", () => {
    const all = { category: "Please, fill in this field", title: "Too short", phone: "Use +91 and 10 digits", adult: "Please, fill in this field" };
    expect(errorsForStep(all, "category")).toEqual({ category: "Please, fill in this field" });
    expect(errorsForStep(all, "details")).toEqual({ title: "Too short" });
    expect(errorsForStep(all, "contact")).toEqual({ phone: "Use +91 and 10 digits" });
    expect(errorsForStep(all, "review")).toEqual({ adult: "Please, fill in this field" });
    expect(errorsForStep(all, "photos")).toEqual({});
  });

  it("finds a step with no errors when the form is complete", () => {
    const complete = validatePost({
      categoryId: "c1",
      cityId: "city1",
      nickname: "Riya",
      title: "2 BHK flat near Adajan",
      text: "Spacious 2 BHK on the 4th floor with lift and parking.",
      phone: "+919825012345",
      contactMode: "both",
      age: "",
      terms: true,
      adult: true,
      attrs: {},
      fields: [],
    });
    expect(complete).toEqual({});
  });

  it("keeps the saved price in the form as text", () => {
    expect(draftToForm({ price: 18000 }).price).toBe("18000");
    expect(draftToForm({ price: null }).price).toBe("");
    expect(draftToForm({}).price).toBe("");
  });
});
