import { useEffect, useRef, useState } from 'react';
import Konami from 'react-konami-code';

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'
];

function replaceAllImages(root: HTMLElement | Document = document) {
  root.querySelectorAll?.('img').forEach(img => {
    if ((img as HTMLImageElement).src !== '/getpizzedoff.jpg') {
      (img as HTMLImageElement).src = '/getpizzedoff.jpg';
    }
  });
  root.querySelectorAll?.('picture source').forEach(source => {
    (source as HTMLSourceElement).srcset = '/getpizzedoff.jpg';
  });
  root.querySelectorAll?.('*').forEach(el => {
    const style = getComputedStyle(el);
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      (el as HTMLElement).style.backgroundImage = 'url(/getpizzedoff.jpg)';
    }
  });
}

function replaceAllText(root: HTMLElement | Document = document) {
  function walk(node: Node) {
    if (node.nodeType === 3) {
      node.textContent = "it's pizza time";
    } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
      node.childNodes.forEach(walk);
    }
  }
  if ('body' in root && root.body) {
    walk(root.body);
  } else {
    walk(root as HTMLElement);
  }
}

function pizzaTimeEverything(root: HTMLElement | Document = document) {
  replaceAllImages(root);
  replaceAllText(root);
}

function throttle(fn: (...args: any[]) => void, wait: number) {
  let last = 0;
  let timeout: any = null;
  return (...args: any[]) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, wait - (now - last));
    }
  };
}

export default function PizzaTimeEasterEgg() {
  const [showPizza, setShowPizza] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const observerTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!showPizza) return;
    pizzaTimeEverything();
    // Throttled callback for observer
    const throttled = throttle((mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            pizzaTimeEverything(node as HTMLElement);
          }
        });
      }
    }, 300);
    observerRef.current = new MutationObserver(throttled);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
    // Disconnect observer after 5 seconds to avoid infinite lag
    observerTimeout.current = setTimeout(() => {
      observerRef.current?.disconnect();
    }, 5000);
    if (!audioRef.current) {
      const audio = document.createElement('audio');
      audio.src = '/pizza-time-theme.mp3';
      audio.loop = true;
      audio.autoplay = true;
      audio.volume = 0.7;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioRef.current = audio;
      audio.play().catch(() => {});
    }
    return () => {
      observerRef.current?.disconnect();
      if (observerTimeout.current) clearTimeout(observerTimeout.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.remove();
      }
    };
  }, [showPizza]);

  return (
    <>
      <Konami action={() => setShowPizza(true)} />
      {showPizza ? (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 99999,
          fontSize: 48,
          pointerEvents: 'none',
          userSelect: 'none',
          filter: 'drop-shadow(0 2px 8px #0008)'
        }}>
          🍕
        </div>
      ) : null}
    </>
  );
} 