'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
};

export function ExperienceLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    let animationFrame = 0;
    let particles: Particle[] = [];
    let width = window.innerWidth;
    let height = window.innerHeight;
    let pointerX = width * 0.7;
    let pointerY = height * 0.25;
    let animationActive = !document.hidden;

    const updateScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      root.style.setProperty('--scroll-progress', String(Math.min(1, Math.max(0, progress))));
      root.toggleAttribute('data-scrolled', window.scrollY > 24);
    };

    const updatePointer = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      root.style.setProperty('--pointer-x', `${pointerX}px`);
      root.style.setProperty('--pointer-y', `${pointerY}px`);
    };

    const resize = () => {
      if (!canvas || !context) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(72, Math.max(30, Math.round((width * height) / 27_000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        radius: 0.6 + Math.random() * 1.4,
        alpha: 0.16 + Math.random() * 0.42,
      }));
    };

    const draw = () => {
      if (!context || !animationActive) return;
      context.clearRect(0, 0, width, height);

      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(151, 171, 255, ${particle.alpha})`;
        context.fill();

        for (let next = index + 1; next < particles.length; next += 1) {
          const neighbor = particles[next];
          if (!neighbor) continue;
          const dx = particle.x - neighbor.x;
          const dy = particle.y - neighbor.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 112) continue;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(neighbor.x, neighbor.y);
          context.strokeStyle = `rgba(124, 145, 255, ${(1 - distance / 112) * 0.1})`;
          context.lineWidth = 0.65;
          context.stroke();
        }

        const pointerDistance = Math.hypot(particle.x - pointerX, particle.y - pointerY);
        if (pointerDistance < 170 && finePointer) {
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(pointerX, pointerY);
          context.strokeStyle = `rgba(171, 140, 255, ${(1 - pointerDistance / 170) * 0.22})`;
          context.stroke();
        }
      });

      animationFrame = window.requestAnimationFrame(draw);
    };

    const updateVisibility = () => {
      animationActive = !document.hidden;
      window.cancelAnimationFrame(animationFrame);
      if (animationActive && !reducedMotion) draw();
    };

    const tiltCleanups: Array<() => void> = [];
    if (!reducedMotion && finePointer) {
      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((surface) => {
        const move = (event: PointerEvent) => {
          const rect = surface.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          surface.style.setProperty('--tilt-x', `${(0.5 - y) * 5}deg`);
          surface.style.setProperty('--tilt-y', `${(x - 0.5) * 6}deg`);
          surface.style.setProperty('--surface-x', `${x * 100}%`);
          surface.style.setProperty('--surface-y', `${y * 100}%`);
        };
        const leave = () => {
          surface.style.setProperty('--tilt-x', '0deg');
          surface.style.setProperty('--tilt-y', '0deg');
        };
        surface.addEventListener('pointermove', move);
        surface.addEventListener('pointerleave', leave);
        tiltCleanups.push(() => {
          surface.removeEventListener('pointermove', move);
          surface.removeEventListener('pointerleave', leave);
        });
      });
    }

    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', updateVisibility);
    if (finePointer) window.addEventListener('pointermove', updatePointer, { passive: true });
    updateScroll();
    resize();
    if (!reducedMotion) draw();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', updatePointer);
      document.removeEventListener('visibilitychange', updateVisibility);
      tiltCleanups.forEach((cleanup) => cleanup());
    };
  }, [pathname]);

  return (
    <div data-ui="experience-layer" className="experience-layer" aria-hidden="true">
      <canvas ref={canvasRef} data-ui="ambient-scene" className="ambient-scene" />
      <div className="pointer-aura" />
      <div className="film-grain" />
      <div className="scroll-progress" />
    </div>
  );
}
