// Spotlight Effect
const cards = document.querySelectorAll('.card, .data-card, .agent-visual');

document.addEventListener('mousemove', e => {
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--x', `${x}px`);
        card.style.setProperty('--y', `${y}px`);
    });
});

// Scroll Reveal
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, {
    threshold: 0.1
});

revealElements.forEach(el => revealObserver.observe(el));

// Particle System
const canvas = document.getElementById('particles');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2;
            this.color = Math.random() > 0.5 ? 'rgba(41, 121, 255, ' : 'rgba(0, 230, 118, ';
            this.alpha = Math.random() * 0.5 + 0.1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color + this.alpha + ')';
            ctx.fill();
        }
    }

    // Create Particles
    for (let i = 0; i < 100; i++) {
        particles.push(new Particle());
    }

    // Shooting Stars
    let shootingStars = [];
    class ShootingStar {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height * 0.5;
            this.len = Math.random() * 80 + 10;
            this.speed = Math.random() * 10 + 6;
            this.size = Math.random() * 1 + 0.1;
            this.waitTime = new Date().getTime() + Math.random() * 3000 + 500;
            this.active = false;
        }

        update() {
            if (this.active) {
                this.x -= this.speed;
                this.y += this.speed;
                if (this.x < 0 || this.y > height) {
                    this.active = false;
                    this.waitTime = new Date().getTime() + Math.random() * 3000 + 500;
                }
            } else {
                if (this.waitTime < new Date().getTime()) {
                    this.active = true;
                    this.x = Math.random() * width + 200;
                    this.y = -100;
                }
            }
        }

        draw() {
            if (this.active) {
                ctx.strokeStyle = 'rgba(255, 255, 255, ' + Math.random() + ')';
                ctx.lineWidth = this.size;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + this.len, this.y - this.len);
                ctx.stroke();
            }
        }
    }

    for (let i = 0; i < 3; i++) {
        shootingStars.push(new ShootingStar());
    }

    let animationId;
    function animate() {
        if (document.hidden) {
            return; // Stop loop if tab is hidden
        }

        ctx.clearRect(0, 0, width, height);

        // Draw Particles
        particles.forEach(p => {
            p.update();
            p.draw();
        });

        // Draw Connections
        particles.forEach((p1, i) => {
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 - dist / 1000})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        });

        // Draw Shooting Stars
        shootingStars.forEach(s => {
            s.update();
            s.draw();
        });

        animationId = requestAnimationFrame(animate);
    }

    // Handle visibility change to pause/resume animation
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            animate();
        } else {
            cancelAnimationFrame(animationId);
        }
    });

    animate();
}
