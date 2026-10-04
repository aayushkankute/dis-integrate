import { useEffect, useRef, useState } from "react";

// ---- Edit your text/links here ---------------------------------------
const ABOUT = {
  title: "About me",
  paragraphs: [
    "I'm Aayush, a Computer Science student at IIIT Dharwad. I've been singing and producing music for six years, all self-taught.",
    "dis/integrate splits a sound into its harmonics so you can hear each one on its own, then rebuild the sound from the ones you pick.",
  ],
  // Put your picture in the project's  public/  folder and set the file name
  // here (public/profile.jpg  ->  "/profile.jpg"). Leave "" for no picture.
  photo: "./public/1.png",
  photoAlt: "Aayush",

  // Paste a URL into any entry to show it; entries with an empty href are
  // hidden. Add or delete lines freely. Email uses "mailto:you@example.com".
  links: [
    { label: "GitHub", href: "https://github.com/aayushkankute" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/aayush-kankute-1985a3303/" },
    { label: "Email", href: "" },
    { label: "Music", href: "https://open.spotify.com/artist/4fjMjwbWKN6cQ19VsYeXke" },
  ],
};

const LINKS = ABOUT.links.filter((link) => link.href);
// -----------------------------------------------------------------------

const SCROLL_THRESHOLD = 8; // ignores tiny trackpad jitter
const SWIPE_THRESHOLD = 50; // px

function AboutMe({ enabled = true }) {
  const [open, setOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  // Scroll down / swipe up opens, scroll up / swipe down closes.
  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }

    let touchStartY = null;

    const onWheel = (e) => {
      if (e.deltaY > SCROLL_THRESHOLD) {
        setOpen(true);
      } else if (e.deltaY < -SCROLL_THRESHOLD) {
        // if the text itself is scrolled, let it scroll back up first
        if (panelRef.current && panelRef.current.scrollTop > 0) return;
        setOpen(false);
      }
    };

    const onTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
      if (touchStartY === null) return;
      const dy = touchStartY - e.changedTouches[0].clientY;
      touchStartY = null;

      if (dy > SWIPE_THRESHOLD) {
        setOpen(true);
      } else if (dy < -SWIPE_THRESHOLD) {
        if (panelRef.current && panelRef.current.scrollTop > 0) return;
        setOpen(false);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled]);

  // Escape closes; focus moves to the Close button when opened.
  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus({ preventScroll: true });

    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {enabled && !open && (
        <div className="scroll-hint">Scroll for about me</div>
      )}

      <div
        ref={panelRef}
        className={`about${open ? " about--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ABOUT.title}
        aria-hidden={!open}
      >
        <div className="about__panel">
          <div className="about__header">
            {ABOUT.photo && !photoFailed && (
              <img
                className="about__photo"
                src={ABOUT.photo}
                alt={ABOUT.photoAlt}
                onError={() => setPhotoFailed(true)}
              />
            )}

            <h2 className="about__title">{ABOUT.title}</h2>
          </div>

          {ABOUT.paragraphs.map((text) => (
            <p key={text} className="about__text">
              {text}
            </p>
          ))}

          {LINKS.length > 0 && (
            <div className="about__links">
              {LINKS.map((link) => {
                const external = /^https?:/i.test(link.href);

                return (
                  <a
                    key={link.label}
                    className="about__link"
                    href={link.href}
                    {...(external
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>
          )}

          <div className="about__footer">
            <button
              ref={closeRef}
              className="upload-button"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            <span className="about__hint">or scroll up</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default AboutMe;