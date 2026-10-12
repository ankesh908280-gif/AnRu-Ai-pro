// visualizer.js - Holographic Quantum Arc Reactor & Audio-Reactive Orb
class QuantumVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.state = 'idle';
        this.audioLevel = 0;
        this.targetAudioLevel = 0;
        this.time = 0;
        this.particles = [];
        this.numParticles = 48;
        this.primaryColor = { r: 0, g: 242, b: 254 };
        this.targetColor = { r: 0, g: 242, b: 254 };

        this.initParticles();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                angle: (Math.PI * 2 * i) / this.numParticles,
                distance: 60 + Math.random() * 50,
                baseDistance: 60 + Math.random() * 50,
                speed: (0.01 + Math.random() * 0.02) * (Math.random() > 0.5 ? 1 : -1),
                size: 1.5 + Math.random() * 2.5,
                alpha: 0.3 + Math.random() * 0.7,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const size = Math.min(rect.width || 280, 360);
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        this.ctx.scale(dpr, dpr);
        this.displaySize = size;
    }

    setState(newState) {
        this.state = newState;
        if (newState === 'listening') {
            this.targetColor = { r: 0, g: 242, b: 254 };
        } else if (newState === 'processing') {
            this.targetColor = { r: 168, g: 85, b: 247 };
        } else if (newState === 'speaking') {
            this.targetColor = { r: 14, g: 165, b: 233 };
        } else {
            this.targetColor = { r: 34, g: 211, b: 238 };
        }
    }

    setAudioLevel(level) {
        this.targetAudioLevel = Math.max(0, Math.min(1, level));
    }

    animate() {
        this.time += 0.03;
        
        this.primaryColor.r += (this.targetColor.r - this.primaryColor.r) * 0.1;
        this.primaryColor.g += (this.targetColor.g - this.primaryColor.g) * 0.1;
        this.primaryColor.b += (this.targetColor.b - this.primaryColor.b) * 0.1;

        if (this.state === 'speaking') {
            this.targetAudioLevel = 0.35 + 0.45 * Math.abs(Math.sin(this.time * 6) * Math.cos(this.time * 3.5));
        } else if (this.state === 'listening' && this.targetAudioLevel < 0.15) {
            this.targetAudioLevel = 0.2 + 0.15 * Math.sin(this.time * 4);
        } else if (this.state === 'idle') {
            this.targetAudioLevel = 0.05 + 0.05 * Math.sin(this.time * 2);
        } else if (this.state === 'processing') {
            this.targetAudioLevel = 0.4 + 0.2 * Math.sin(this.time * 8);
        }

        this.audioLevel += (this.targetAudioLevel - this.audioLevel) * 0.2;

        this.draw();
        requestAnimationFrame(this.animate);
    }

    draw() {
        const ctx = this.ctx;
        const size = this.displaySize || 280;
        const cx = size / 2;
        const cy = size / 2;

        ctx.clearRect(0, 0, size, size);

        const { r, g, b } = this.primaryColor;
        const baseRadius = size * 0.26;
        const reactiveRadius = baseRadius + this.audioLevel * 30;

        // Aura
        const auraGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.2, cx, cy, baseRadius * 2.2);
        auraGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.18 + this.audioLevel * 0.2})`);
        auraGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.05)`);
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Ticks
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.time * 0.2);

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius * 1.55, 0, Math.PI * 2);
        ctx.stroke();

        const numTicks = 36;
        for (let i = 0; i < numTicks; i++) {
            const angle = (Math.PI * 2 * i) / numTicks;
            const isMajor = i % 9 === 0;
            const len = isMajor ? 8 : 4;
            const r1 = baseRadius * 1.55 - len;
            const r2 = baseRadius * 1.55;
            ctx.strokeStyle = isMajor ? `rgba(${r}, ${g}, ${b}, 0.8)` : `rgba(${r}, ${g}, ${b}, 0.25)`;
            ctx.lineWidth = isMajor ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
            ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
            ctx.stroke();
        }
        ctx.restore();

        // Segmented Arc Ring
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-this.time * 0.4);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
        for (let i = 0; i < 3; i++) {
            const startA = (i * Math.PI * 2) / 3;
            const endA = startA + Math.PI * 0.45;
            ctx.beginPath();
            ctx.arc(0, 0, baseRadius * 1.35 + this.audioLevel * 10, startA, endA);
            ctx.stroke();
        }
        ctx.restore();

        // Particles
        this.particles.forEach(p => {
            p.angle += p.speed * (this.state === 'processing' ? 3 : 1);
            const dist = (p.baseDistance / 100) * (baseRadius * 1.25) + Math.sin(this.time * 2 + p.pulseOffset) * 6 + this.audioLevel * 18;
            const px = cx + Math.cos(p.angle) * dist;
            const py = cy + Math.sin(p.angle) * dist;

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(px, py, p.size + this.audioLevel * 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        // Waveform Tentacles
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + this.audioLevel * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const wavePoints = 72;
        for (let i = 0; i <= wavePoints; i++) {
            const angle = (Math.PI * 2 * i) / wavePoints;
            const wave = Math.sin(angle * 6 + this.time * 5) * (this.audioLevel * 14) +
                         Math.cos(angle * 12 - this.time * 3) * (this.audioLevel * 6);
            const rad = reactiveRadius + wave;
            const wx = Math.cos(angle) * rad;
            const wy = Math.sin(angle) * rad;
            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Core Plasma Reactor Sphere
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, reactiveRadius * 0.85);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.95)`);
        coreGrad.addColorStop(0.75, `rgba(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.9)}, 0.4)`);
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = coreGrad;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
        ctx.shadowBlur = 24 + this.audioLevel * 20;
        ctx.beginPath();
        ctx.arc(cx, cy, reactiveRadius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Center White Node
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 0.18 + this.audioLevel * 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

window.QuantumVisualizer = QuantumVisualizer;
