const tiltItems = document.querySelectorAll("[data-tilt]");
const sparkItems = document.querySelectorAll("[data-spark]");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function handleTilt(event) {
  const { currentTarget, clientX, clientY } = event;
  const rect = currentTarget.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const percentX = clamp((x / rect.width - 0.5) * 12, -12, 12);
  const percentY = clamp((y / rect.height - 0.5) * 12, -12, 12);

  currentTarget.style.transform = `perspective(800px) rotateX(${-percentY}deg) rotateY(${percentX}deg)`;
}

function resetTilt({ currentTarget }) {
  currentTarget.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
}

tiltItems.forEach((item) => {
  item.addEventListener("mousemove", handleTilt);
  item.addEventListener("mouseleave", resetTilt);
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.borderColor = "rgba(93, 224, 255, 0.6)";
        entry.target.style.transform = "translateY(-6px)";
      } else {
        entry.target.style.borderColor = "var(--border)";
        entry.target.style.transform = "translateY(0px)";
      }
    });
  },
  { threshold: 0.4 }
);

sparkItems.forEach((card) => observer.observe(card));

const form = document.querySelector(".cta-form");
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.reset();
    form.classList.add("submitted");
    setTimeout(() => form.classList.remove("submitted"), 2000);
  });
}
