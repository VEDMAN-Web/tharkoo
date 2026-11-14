"use client";

/**
 * H6.19 live preview: a card that follows the form as the user types. It is not the public card, so it never
 * counts a view or a click.
 */
export function PostPreview({ title, text, categoryName, cityName, nickname }: { title: string; text: string; categoryName: string; cityName: string; nickname: string }) {
  const shortText = text.trim().slice(0, 160);
  return (
    <article className="tk-glass tk-post-preview" aria-label="Preview of your ad" data-tk="post-preview">
      <div className="tk-post-preview-photo" aria-hidden>
        <span>Photo</span>
      </div>
      <p className="tk-post-preview-cat">{categoryName || "Category"}</p>
      <h3 className="tk-post-preview-title">{title.trim() || "Your title appears here"}</h3>
      <p className="tk-post-preview-meta">
        {cityName || "City"}
        {nickname.trim() ? ` · ${nickname.trim()}` : ""}
      </p>
      <p className="tk-post-preview-text">{shortText || "Your description appears here as you type."}</p>
    </article>
  );
}
