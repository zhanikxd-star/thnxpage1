import { formatClock, nextPlaybackHead } from "./playback.js";

const POLL_MS = 250;
const CORRECT_LOCK_MS = 700;

function loadYouTubeApi() {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const previous = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error("youtube-timeout")), 12000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previous?.();
      resolve(window.YT);
    };

    if (!document.querySelector("script[data-youtube-api]")) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.dataset.youtubeApi = "true";
      tag.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("youtube-script"));
      };
      document.head.appendChild(tag);
    }
  });
}

function paint(root, player, playing) {
  const play = root.querySelector("[data-player-play]");
  const mute = root.querySelector("[data-player-mute]");
  const time = root.querySelector("[data-player-time]");
  const fill = root.querySelector("[data-player-fill]");
  const duration = player?.getDuration?.() || 0;
  const current = player?.getCurrentTime?.() || 0;

  if (play) {
    play.textContent = playing ? "Пауза" : "Смотреть";
    play.setAttribute("aria-pressed", playing ? "true" : "false");
    play.setAttribute("aria-label", playing ? "Пауза" : "Смотреть пример");
  }

  if (mute && player?.isMuted) {
    const muted = player.isMuted();
    mute.textContent = muted ? "Без звука" : "Звук";
    mute.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  if (time) time.textContent = formatClock(current);
  if (fill) {
    const ratio = duration > 0 ? Math.min(1, current / duration) : 0;
    fill.style.width = `${ratio * 100}%`;
  }

  root.classList.toggle("is-started", playing || current > 0.35);
}

export function mountExamplePlayer(root) {
  if (!root) return;
  const videoId = root.dataset.videoId;
  const play = root.querySelector("[data-player-play]");
  const mute = root.querySelector("[data-player-mute]");
  const fullscreen = root.querySelector("[data-player-fullscreen]");
  const surface = root.querySelector("[data-player-surface]");
  const status = root.querySelector("[data-player-status]");
  let head = 0;
  let correcting = false;
  let player = null;
  let poll = 0;

  function guard() {
    if (!player?.getCurrentTime) return;
    const state = player.getPlayerState?.();
    const playing = state === window.YT.PlayerState.PLAYING;
    const current = player.getCurrentTime();
    const step = nextPlaybackHead(head, current, playing);
    if (step.seekBack) {
      if (!correcting) {
        correcting = true;
        const unstarted =
          state === window.YT?.PlayerState?.UNSTARTED ||
          state === window.YT?.PlayerState?.CUED ||
          state === -1;
        if (unstarted && player.cueVideoById) {
          player.cueVideoById({ videoId, startSeconds: head });
        } else {
          player.seekTo(head, true);
          if (playing) player.playVideo();
        }
        window.setTimeout(() => {
          correcting = false;
        }, CORRECT_LOCK_MS);
      }
    } else {
      head = step.head;
    }
    paint(root, player, playing);
  }

  function togglePlay() {
    if (!player?.getPlayerState) return;
    const playing = player.getPlayerState() === window.YT.PlayerState.PLAYING;
    if (playing) player.pauseVideo();
    else player.playVideo();
  }

  play?.addEventListener("click", togglePlay);
  surface?.addEventListener("click", togglePlay);
  mute?.addEventListener("click", () => {
    if (!player?.isMuted) return;
    if (player.isMuted()) player.unMute();
    else player.mute();
    paint(root, player, player.getPlayerState() === window.YT.PlayerState.PLAYING);
  });

  function paintFullscreen() {
    if (!fullscreen) return;
    const open = document.fullscreenElement === root;
    fullscreen.textContent = open ? "Свернуть" : "На весь экран";
    fullscreen.setAttribute("aria-pressed", open ? "true" : "false");
    fullscreen.setAttribute("aria-label", open ? "Выйти из полного экрана" : "Открыть видео на весь экран");
  }

  fullscreen?.addEventListener("click", () => {
    const request = root.requestFullscreen?.bind(root);
    if (!request) return;
    if (document.fullscreenElement === root) document.exitFullscreen?.();
    else request().catch(() => {});
  });
  document.addEventListener("fullscreenchange", paintFullscreen);
  paintFullscreen();

  root.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".player-stage")) event.preventDefault();
  });

  root.addEventListener("keydown", (event) => {
    const seekKey =
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === "j" ||
      event.key === "l" ||
      event.key === "J" ||
      event.key === "L" ||
      (event.key >= "0" && event.key <= "9");
    if (!seekKey) return;
    event.preventDefault();
    event.stopPropagation();
  });

  loadYouTubeApi()
    .then(
      (YT) =>
        new Promise((resolve) => {
          player = new YT.Player("vsl-youtube", {
            videoId,
            host: "https://www.youtube-nocookie.com",
            playerVars: {
              controls: 0,
              disablekb: 1,
              fs: 0,
              rel: 0,
              modestbranding: 1,
              iv_load_policy: 3,
              playsinline: 1,
              cc_load_policy: 0,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                const frame = player.getIframe?.();
                if (frame) frame.setAttribute("tabindex", "-1");
                root.ytPlayer = player;
                paint(root, player, false);
                poll = window.setInterval(guard, POLL_MS);
                resolve();
              },
              onStateChange: () => guard(),
            },
          });
        }),
    )
    .catch(() => {
      if (status) {
        status.hidden = false;
        status.textContent = "Пример ролика сейчас не загрузился. Перемотка в плеере всё равно отключена.";
      }
    });
}
