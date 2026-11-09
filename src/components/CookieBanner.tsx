"use client";

import { useEffect, useState } from "react";

export function CookieBanner({
  body,
  accept,
  necessary,
}: {
  body?: string;
  accept?: string;
  necessary?: string;
}) {
  const [open, setOpen] = useState(true);
  const [manage, setManage] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("nl-cookies")) setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="cookie-modal" data-testid="cookie-banner">
      <div className="cookie-card">
        {manage ? (
          <>
            <p className="text-sm">
              You can personalise the cookies we use by providing your consent using the buttons below.
            </p>
            <ul className="cookie-list">
              <li>
                <span>Strictly Necessary cookies</span>
                <b>Always active</b>
              </li>
              <li>
                <span>Analytical/Performance Cookies</span>
              </li>
              <li>
                <span>Advertising Cookies</span>
              </li>
            </ul>
            <button
              type="button"
              className="age-yes"
              onClick={() => {
                localStorage.setItem("nl-cookies", "all");
                setOpen(false);
              }}
            >
              {accept || "Accept all"}
            </button>
            <button
              type="button"
              className="cookie-link"
              onClick={() => {
                localStorage.setItem("nl-cookies", "necessary");
                setOpen(false);
              }}
            >
              {necessary || "Accept my Preferences"}
            </button>
          </>
        ) : (
          <>
            <p>
              <b>About cookies on this website</b>
            </p>
            <p className="text-sm">
              {body ||
                "We use cookies to optimize the performance of this website and provide you with a better user experience in a personalized way. In the options you can choose your preferences for the use of cookies:"}
            </p>
            <button
              type="button"
              className="age-yes"
              onClick={() => {
                localStorage.setItem("nl-cookies", "all");
                setOpen(false);
              }}
            >
              {accept || "Accept all"}
            </button>
            <button type="button" className="cookie-link" onClick={() => setManage(true)}>
              Manage cookies
            </button>
            <p className="cookie-more">
              For more information, please visit our <a href="/cookies/">Cookie Notice</a> and our{" "}
              <a href="/privacy/">Privacy Notice</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
