/* ================================================
   TOPSHELF SOLAR TECH & INNOVATIONS
   Main JavaScript
   ================================================ */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initPreloader();
    initNavigation();
    initHeroSlider();
    initSmoothScroll();
    initScrollAnimations();
    initCounterAnimation();
    initPackageTabs();
    initContactForm();
    initBackToTop();
    initGaugeAnimation();
    initButtonActions();
    initMobileOptimizations();
    initSolarConfigurator();
});

/* ==========================================
   PRELOADER
   ========================================== */
function initPreloader() {
    const preloader = document.getElementById('preloader');
    
    window.addEventListener('load', function() {
        setTimeout(function() {
            preloader.classList.add('loaded');
            document.body.style.overflow = 'auto';
        }, 500);
    });
}

/* ==========================================
   NAVIGATION
   ========================================== */
function initNavigation() {
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);
    
    // Scroll effect for header
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
    
    // Mobile menu toggle
    menuToggle.addEventListener('click', function() {
        this.classList.toggle('active');
        navMenu.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    });
    
    // Close menu on overlay click
    overlay.addEventListener('click', function() {
        menuToggle.classList.remove('active');
        navMenu.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Close menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            menuToggle.classList.remove('active');
            navMenu.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
    
    // Active link on scroll
    window.addEventListener('scroll', function() {
        let current = '';
        const sections = document.querySelectorAll('section[id]');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            if (pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    });
}

/* ==========================================
   HERO SLIDER
   ========================================== */
function initHeroSlider() {
    const slides = document.querySelectorAll('.slide');
    const dotsContainer = document.querySelector('.slider-dots');
    const prevBtn = document.querySelector('.slider-btn.prev');
    const nextBtn = document.querySelector('.slider-btn.next');
    let currentSlide = 0;
    let slideInterval;
    
    // Create dots
    slides.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.className = 'dot' + (index === 0 ? ' active' : '');
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });
    
    const dots = document.querySelectorAll('.slider-dots .dot');
    
    function goToSlide(index) {
        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');
        
        currentSlide = index;
        if (currentSlide >= slides.length) currentSlide = 0;
        if (currentSlide < 0) currentSlide = slides.length - 1;
        
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }
    
    function nextSlide() {
        goToSlide(currentSlide + 1);
    }
    
    function prevSlide() {
        goToSlide(currentSlide - 1);
    }
    
    // Event listeners
    nextBtn.addEventListener('click', () => {
        nextSlide();
        resetInterval();
    });
    
    prevBtn.addEventListener('click', () => {
        prevSlide();
        resetInterval();
    });
    
    // Auto slide
    function startInterval() {
        slideInterval = setInterval(nextSlide, 5000);
    }
    
    function resetInterval() {
        clearInterval(slideInterval);
        startInterval();
    }
    
    startInterval();
    
    // Pause on hover
    const heroSlider = document.querySelector('.hero-slider');
    heroSlider.addEventListener('mouseenter', () => clearInterval(slideInterval));
    heroSlider.addEventListener('mouseleave', startInterval);
    
    // Touch support
    let touchStartX = 0;
    let touchEndX = 0;
    
    heroSlider.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    heroSlider.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
            resetInterval();
        }
    }
}

/* ==========================================
   SMOOTH SCROLL
   ========================================== */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                const headerHeight = document.getElementById('header').offsetHeight;
                const targetPosition = target.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ==========================================
   SCROLL ANIMATIONS
   ========================================== */
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll(
        '.section-header, .product-card, .package-card, .project-card, ' +
        '.testimonial-card, .about-content, .about-images, .mv-card, ' +
        '.showroom-card, .info-card'
    );
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

/* ==========================================
   COUNTER ANIMATION
   ========================================== */
function initCounterAnimation() {
    const counters = document.querySelectorAll('[data-count]');
    
    if (counters.length === 0) return;
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                if (counter.dataset.animated) return;
                counter.dataset.animated = 'true';
                const target = parseInt(counter.getAttribute('data-count'));
                counter.textContent = '0';
                animateCounter(counter, target);
                observer.unobserve(counter);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => observer.observe(counter));
    
    function animateCounter(element, target) {
        let current = 0;
        const increment = target / 40;
        const stepTime = 40;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, stepTime);
    }
}

/* ==========================================
   PACKAGE TABS
   ========================================== */
function initPackageTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Remove active from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active to clicked button and corresponding content
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

/* ==========================================
   CONTACT FORM
   ========================================== */
function initContactForm() {
    const form = document.getElementById('contactForm');
    
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            // Basic validation
            if (!data.name || !data.phone || !data.email || !data.message) {
                showNotification('Please fill in all required fields.', 'error');
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                showNotification('Please enter a valid email address.', 'error');
                return;
            }
            
            // Phone validation
            const phoneRegex = /^[0-9]{10,11}$/;
            const cleanPhone = data.phone.replace(/[^0-9]/g, '');
            if (!phoneRegex.test(cleanPhone)) {
                showNotification('Please enter a valid phone number.', 'error');
                return;
            }
            
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitBtn.disabled = true;
            
            // Simulate form submission (replace with actual API call)
            setTimeout(() => {
                showNotification('Thank you! Your message has been sent successfully. We will contact you soon.', 'success');
                form.reset();
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 1500);
        });
    }
}

function showNotification(message, type) {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        max-width: 400px;
        padding: 20px 25px;
        background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        color: white;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

/* ==========================================
   BACK TO TOP
   ========================================== */
function initBackToTop() {
    const backToTop = document.getElementById('backToTop');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });
    
    backToTop.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/* ==========================================
   GAUGE ANIMATION
   ========================================== */
function initGaugeAnimation() {
    const gauge = document.querySelector('.gauge-fill');
    
    if (gauge) {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.5
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Animate gauge fill
                    setTimeout(() => {
                        gauge.style.strokeDashoffset = '70';
                    }, 500);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        observer.observe(gauge);
    }
}

/* ==========================================
   PROJECT GALLERY
   ========================================== */
document.addEventListener('DOMContentLoaded', function() {
    const mainImage = document.querySelector('.featured-project .main-image img');
    const thumbnails = document.querySelectorAll('.thumbnail-gallery img');
    
    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', function() {
            const tempSrc = mainImage.src;
            mainImage.src = this.src;
            this.src = tempSrc;
        });
    });
});

/* ==========================================
   LAZY LOADING IMAGES
   ========================================== */
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.getAttribute('data-src');
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
});

/* ==========================================
   PARALLAX EFFECT
   ========================================== */
document.addEventListener('DOMContentLoaded', function() {
    const parallaxElements = document.querySelectorAll('.slide');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        parallaxElements.forEach(el => {
            const speed = 0.5;
            el.style.backgroundPositionY = `${scrolled * speed}px`;
        });
    });
});

/* ==========================================
   UTILITY FUNCTIONS
   ========================================== */

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0
    }).format(amount);
}

/* ==========================================
   RESIZE HANDLER
   ========================================== */
window.addEventListener('resize', debounce(function() {
    // Close mobile menu on resize
    const navMenu = document.getElementById('navMenu');
    const menuToggle = document.getElementById('menuToggle');
    const overlay = document.querySelector('.nav-overlay');
    
    if (window.innerWidth > 992 && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        menuToggle.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}, 250));

/* ==========================================
   KEYBOARD ACCESSIBILITY
   ========================================== */
document.addEventListener('keydown', function(e) {
    // Close mobile menu on Escape
    if (e.key === 'Escape') {
        const navMenu = document.getElementById('navMenu');
        const menuToggle = document.getElementById('menuToggle');
        const overlay = document.querySelector('.nav-overlay');
        
        if (navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            menuToggle.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
});

/* ==========================================
   BUTTON ACTIONS
   ========================================== */
function initButtonActions() {
    // Handle all call buttons
    const callButtons = document.querySelectorAll('a[href^="tel:"]');
    callButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Track call button clicks (analytics placeholder)
            console.log('Call button clicked:', this.href);
        });
    });
    
    // Handle SMS buttons
    const smsButtons = document.querySelectorAll('a[href^="sms:"]');
    smsButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Ensure proper SMS formatting
            console.log('SMS button clicked:', this.href);
        });
    });
    
    // Handle WhatsApp button
    const whatsappBtn = document.querySelector('.whatsapp-float');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function(e) {
            console.log('WhatsApp button clicked');
        });
    }
    
    // Add ripple effect to all buttons
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            // Create ripple element
            const ripple = document.createElement('span');
            ripple.classList.add('ripple-effect');
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.4);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });
    
    // Add ripple animation style
    if (!document.querySelector('#ripple-style')) {
        const style = document.createElement('style');
        style.id = 'ripple-style';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Handle "Get Quote" buttons
    document.querySelectorAll('.btn-outline').forEach(btn => {
        if (btn.textContent.includes('Get Quote') || btn.textContent.includes('Quote')) {
            btn.addEventListener('click', function(e) {
                if (!this.href || this.href === '#') {
                    e.preventDefault();
                    window.location.href = 'contact.html';
                }
            });
        }
    });
}

/* ==========================================
   MOBILE OPTIMIZATIONS
   ========================================== */
function initMobileOptimizations() {
    // Detect mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        document.body.classList.add('is-mobile');
        
        // Optimize touch interactions
        document.querySelectorAll('.product-card, .package-card, .project-card').forEach(card => {
            card.addEventListener('touchstart', function() {
                this.classList.add('touch-active');
            }, { passive: true });
            
            card.addEventListener('touchend', function() {
                setTimeout(() => this.classList.remove('touch-active'), 150);
            }, { passive: true });
        });
        
        // Fix iOS input zoom
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea, select');
        inputs.forEach(input => {
            input.style.fontSize = '16px';
        });
    }
    
    // Handle viewport height on mobile browsers
    function setViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    setViewportHeight();
    window.addEventListener('resize', throttle(setViewportHeight, 100));
    
    // Smooth scroll for anchor links on mobile
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                const headerHeight = document.getElementById('header').offsetHeight;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Optimize images loading on mobile
    if ('connection' in navigator) {
        if (navigator.connection.saveData || navigator.connection.effectiveType === '2g') {
            document.querySelectorAll('img').forEach(img => {
                if (img.dataset.lowsrc) {
                    img.src = img.dataset.lowsrc;
                }
            });
        }
    }
}

/* ==========================================
   TOUCH ACTIVE STYLES
   ========================================== */
const touchActiveStyle = document.createElement('style');
touchActiveStyle.textContent = `
    .touch-active {
        transform: scale(0.98) !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
    }
    
    .is-mobile .product-card:hover,
    .is-mobile .package-card:hover,
    .is-mobile .project-card:hover {
        transform: none;
    }
`;
document.head.appendChild(touchActiveStyle);

/* ==========================================
   SOLAR SYSTEM CONFIGURATOR
   ========================================== */
function initSolarConfigurator() {
    if (!document.getElementById('appliancesGrid')) return;

    const APPLIANCES = {
        residential: [
            { id: 'r_led',     name: 'LED Bulb',           watts: 9,    icon: 'fa-lightbulb',     defQty: 5, defHrs: 6  },
            { id: 'r_cfan',    name: 'Ceiling Fan',         watts: 70,   icon: 'fa-fan',            defQty: 1, defHrs: 8  },
            { id: 'r_sfan',    name: 'Stand Fan',           watts: 40,   icon: 'fa-fan',            defQty: 0, defHrs: 8  },
            { id: 'r_tv32',    name: '32" LED TV',          watts: 40,   icon: 'fa-tv',             defQty: 1, defHrs: 5  },
            { id: 'r_tv43',    name: '43" LED TV',          watts: 80,   icon: 'fa-tv',             defQty: 0, defHrs: 5  },
            { id: 'r_laptop',  name: 'Laptop',              watts: 65,   icon: 'fa-laptop',         defQty: 0, defHrs: 4  },
            { id: 'r_phone',   name: 'Phone Charger',       watts: 10,   icon: 'fa-mobile-alt',     defQty: 2, defHrs: 3  },
            { id: 'r_ref',     name: 'Refrigerator',        watts: 150,  icon: 'fa-snowflake',      defQty: 0, defHrs: 24 },
            { id: 'r_washer',  name: 'Washing Machine',     watts: 500,  icon: 'fa-tshirt',         defQty: 0, defHrs: 2  },
            { id: 'r_rice',    name: 'Rice Cooker',         watts: 600,  icon: 'fa-utensils',       defQty: 0, defHrs: 1  },
            { id: 'r_micro',   name: 'Microwave Oven',      watts: 800,  icon: 'fa-fire-alt',       defQty: 0, defHrs: 1  },
            { id: 'r_ac1',     name: 'Air Con 1HP',         watts: 750,  icon: 'fa-wind',           defQty: 0, defHrs: 8  },
            { id: 'r_ac2',     name: 'Air Con 2HP',         watts: 1500, icon: 'fa-wind',           defQty: 0, defHrs: 8  },
            { id: 'r_pump',    name: 'Water Pump 0.5HP',    watts: 370,  icon: 'fa-tint',           defQty: 0, defHrs: 2  },
            { id: 'r_iron',    name: 'Electric Iron',       watts: 1000, icon: 'fa-fire-alt',       defQty: 0, defHrs: 1  },
        ],
        commercial: [
            { id: 'c_tube',    name: 'LED Tube 24W',        watts: 24,   icon: 'fa-lightbulb',      defQty: 6, defHrs: 10 },
            { id: 'c_panel',   name: 'LED Panel 18W',       watts: 18,   icon: 'fa-th-large',       defQty: 4, defHrs: 10 },
            { id: 'c_ac',      name: 'Split AC 1.5HP',      watts: 1100, icon: 'fa-wind',           defQty: 0, defHrs: 8  },
            { id: 'c_pc',      name: 'Desktop Computer',    watts: 200,  icon: 'fa-desktop',        defQty: 0, defHrs: 8  },
            { id: 'c_printer', name: 'Printer / Copier',    watts: 300,  icon: 'fa-print',          defQty: 0, defHrs: 2  },
            { id: 'c_cctv',    name: 'CCTV System',         watts: 30,   icon: 'fa-video',          defQty: 0, defHrs: 24 },
            { id: 'c_wifi',    name: 'WiFi Router',         watts: 15,   icon: 'fa-wifi',           defQty: 1, defHrs: 24 },
            { id: 'c_pos',     name: 'POS Terminal',        watts: 35,   icon: 'fa-cash-register',  defQty: 0, defHrs: 10 },
            { id: 'c_dfridge', name: 'Display Refrigerator',watts: 400,  icon: 'fa-snowflake',      defQty: 0, defHrs: 24 },
            { id: 'c_exhaust', name: 'Exhaust Fan',         watts: 50,   icon: 'fa-fan',            defQty: 0, defHrs: 8  },
            { id: 'c_micro',   name: 'Microwave Oven',      watts: 800,  icon: 'fa-fire-alt',       defQty: 0, defHrs: 1  },
            { id: 'c_kettle',  name: 'Electric Kettle',     watts: 1500, icon: 'fa-mug-hot',        defQty: 0, defHrs: 1  },
        ],
        industrial: [
            { id: 'i_higbay',  name: 'High Bay LED 150W',   watts: 150,  icon: 'fa-lightbulb',      defQty: 5, defHrs: 10 },
            { id: 'i_ifan',    name: 'Industrial Fan',       watts: 200,  icon: 'fa-fan',            defQty: 0, defHrs: 8  },
            { id: 'i_motor1',  name: 'Motor 1HP',            watts: 750,  icon: 'fa-cog',            defQty: 0, defHrs: 8  },
            { id: 'i_motor3',  name: 'Motor 3HP',            watts: 2200, icon: 'fa-cog',            defQty: 0, defHrs: 8  },
            { id: 'i_ac5',     name: 'Industrial AC 5HP',    watts: 3700, icon: 'fa-wind',           defQty: 0, defHrs: 8  },
            { id: 'i_welder',  name: 'Welding Machine',      watts: 2000, icon: 'fa-fire-alt',       defQty: 0, defHrs: 4  },
            { id: 'i_comp',    name: 'Air Compressor 2HP',   watts: 1500, icon: 'fa-tachometer-alt', defQty: 0, defHrs: 4  },
            { id: 'i_pump',    name: 'Water Pump 1.5HP',     watts: 1100, icon: 'fa-tint',           defQty: 0, defHrs: 4  },
            { id: 'i_cctv',    name: 'CCTV / Security',      watts: 50,   icon: 'fa-video',          defQty: 0, defHrs: 24 },
            { id: 'i_sec',     name: 'Security Lighting',    watts: 100,  icon: 'fa-shield-alt',     defQty: 0, defHrs: 12 },
        ]
    };

    const PACKAGES = [
        { watts: 60,    price: 10000,  panels: '1× 60W panel',     inverter: '300W inverter',   battery: '50Ah 12V'   },
        { watts: 120,   price: 20000,  panels: '1× 120W panel',    inverter: '300W inverter',   battery: '100Ah 12V'  },
        { watts: 240,   price: 40000,  panels: '2× 120W panels',   inverter: '500W inverter',   battery: '200Ah 12V'  },
        { watts: 380,   price: 60000,  panels: '2× 190W panels',   inverter: '1000W inverter',  battery: '200Ah 12V'  },
        { watts: 500,   price: 80000,  panels: '2× 250W panels',   inverter: '1500W inverter',  battery: '100Ah 24V'  },
        { watts: 1000,  price: 120000, panels: '4× 250W panels',   inverter: '2000W inverter',  battery: '200Ah 24V'  },
        { watts: 2000,  price: 200000, panels: '8× 250W panels',   inverter: '3000W inverter',  battery: '200Ah 48V'  },
        { watts: 3000,  price: 300000, panels: '12× 250W panels',  inverter: '5000W inverter',  battery: '400Ah 48V'  },
        { watts: 5000,  price: 450000, panels: '20× 250W panels',  inverter: '8000W inverter',  battery: '600Ah 48V'  },
        { watts: 10000, price: 850000, panels: '40× 250W panels',  inverter: '15kW inverter',   battery: '1200Ah 48V' },
    ];

    let activeType   = 'hybrid';
    let activeSector = 'residential';

    // ── Render appliance cards ──────────────────────────────────────────────
    function renderAppliances() {
        const grid = document.getElementById('appliancesGrid');
        const list = APPLIANCES[activeSector];

        grid.innerHTML = list.map(a => `
            <div class="appliance-item${a.defQty > 0 ? ' active' : ''}" data-id="${a.id}">
                <label class="app-checkbox">
                    <input type="checkbox" data-id="${a.id}" ${a.defQty > 0 ? 'checked' : ''}>
                </label>
                <div class="appliance-icon"><i class="fas ${a.icon}"></i></div>
                <div class="appliance-info">
                    <div class="appliance-name">${a.name}</div>
                    <div class="appliance-watts">${a.watts}W each</div>
                </div>
                <div class="appliance-controls">
                    <div class="ctrl-row">
                        <span class="ctrl-lbl">Qty</span>
                        <div class="qty-input">
                            <button class="qty-btn" onclick="cfgAdj(this,-1,'qty')">−</button>
                            <input type="number" class="qty-field" value="${a.defQty}" min="0" max="50">
                            <button class="qty-btn" onclick="cfgAdj(this,1,'qty')">+</button>
                        </div>
                    </div>
                    <div class="ctrl-row">
                        <span class="ctrl-lbl">Hrs</span>
                        <div class="qty-input">
                            <button class="qty-btn" onclick="cfgAdj(this,-1,'hrs')">−</button>
                            <input type="number" class="hrs-field" value="${a.defHrs}" min="1" max="24">
                            <button class="qty-btn" onclick="cfgAdj(this,1,'hrs')">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', function() {
                const item = this.closest('.appliance-item');
                const qtyField = item.querySelector('.qty-field');
                if (this.checked) {
                    item.classList.add('active');
                    if (parseInt(qtyField.value) === 0) qtyField.value = 1;
                } else {
                    item.classList.remove('active');
                    qtyField.value = 0;
                }
                updateConfig();
            });
        });

        grid.querySelectorAll('.qty-field, .hrs-field').forEach(inp => {
            inp.addEventListener('input', updateConfig);
        });

        updateConfig();
    }

    // Global helper for +/- buttons (called via onclick attribute)
    window.cfgAdj = function(btn, delta, type) {
        const row   = btn.closest('.ctrl-row');
        const field = row.querySelector('.' + (type === 'qty' ? 'qty-field' : 'hrs-field'));
        const min   = parseInt(field.min) || 0;
        const max   = parseInt(field.max) || 50;
        const val   = Math.min(max, Math.max(min, (parseInt(field.value) || 0) + delta));
        field.value = val;
        if (type === 'qty') {
            const item = btn.closest('.appliance-item');
            const chk  = item ? item.querySelector('input[type="checkbox"]') : null;
            if (item && chk) {
                if (val > 0) { item.classList.add('active');    chk.checked = true;  }
                else         { item.classList.remove('active'); chk.checked = false; }
            }
        }
        updateConfig();
    };

    // ── Recalculate & update display ────────────────────────────────────────
    function updateConfig() {
        const list = APPLIANCES[activeSector];
        let totalW = 0, dailyWh = 0;
        const selected = [];

        list.forEach(a => {
            const item = document.querySelector(`.appliance-item[data-id="${a.id}"]`);
            if (!item) return;
            const qty = Math.max(0, parseInt(item.querySelector('.qty-field').value) || 0);
            const hrs = Math.max(1, parseInt(item.querySelector('.hrs-field').value) || 1);
            if (qty > 0) {
                const w = a.watts * qty;
                totalW   += w;
                dailyWh  += w * hrs;
                selected.push({ ...a, qty, hrs, totalW: w });
            }
        });

        // Solar sizing: daily Wh / (5 peak-sun-hours × 0.75 efficiency)
        const panelReq = totalW > 0 ? Math.ceil((dailyWh / 5) / 0.75) : 0;

        // Find matching package
        let pkg = PACKAGES[PACKAGES.length - 1];
        for (const p of PACKAGES) {
            if (p.watts >= panelReq) { pkg = p; break; }
        }

        // Battery: 1.5-day autonomy, 50% DoD, 48V bank
        const battAh = (activeType !== 'gridtied' && totalW > 0)
            ? Math.ceil((dailyWh * 1.5) / (48 * 0.5))
            : 0;

        // ── Update UI ─────────────────────────────────────────────────────
        document.getElementById('totalWatts').textContent   = totalW.toLocaleString() + ' W';
        document.getElementById('dailyEnergy').textContent  = totalW > 0 ? (dailyWh / 1000).toFixed(2) + ' kWh/day' : '0 kWh/day';
        document.getElementById('recPanels').textContent    = totalW > 0 ? pkg.panels    : '—';
        document.getElementById('recInverter').textContent  = totalW > 0 ? pkg.inverter  : '—';
        document.getElementById('recBattery').textContent   = totalW > 0
            ? (activeType === 'gridtied' ? 'None (Grid-Tied)' : battAh + ' Ah @ 48V')
            : '—';
        document.getElementById('recLabel').textContent     = totalW > 0
            ? (pkg.watts >= 1000 ? (pkg.watts / 1000) + 'kW System' : pkg.watts + 'W System')
            : '—';
        document.getElementById('priceEstimate').textContent = totalW > 0
            ? '₱' + pkg.price.toLocaleString() + '+'
            : '₱0';

        // Load summary list
        const selEl = document.getElementById('selectedAppliances');
        if (selected.length === 0) {
            selEl.innerHTML = '<div class="no-selection">Select appliances above to calculate your load</div>';
        } else {
            selEl.innerHTML = selected.map(s => `
                <div class="sel-appliance">
                    <i class="fas ${s.icon}"></i>
                    <span class="sel-name">${s.name}</span>
                    <span class="sel-detail">${s.qty}× ${s.hrs}h</span>
                    <span class="sel-watts">${s.totalW}W</span>
                </div>
            `).join('');
        }

        renderDiagram(activeType);
    }

    // ── SVG Wiring Diagrams ─────────────────────────────────────────────────
    function renderDiagram(type) {
        const el = document.getElementById('liveSystemDiagram');
        if (!el) return;

        const SVG = {
            offgrid: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
  <defs>
    <marker id="ao" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#f7931e"/></marker>
    <marker id="ag" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#27ae60"/></marker>
    <marker id="ar" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#e74c3c"/></marker>
  </defs>
  <!-- Sun -->
  <circle cx="40" cy="55" r="24" fill="#FFD700" opacity="0.9"/>
  <circle cx="40" cy="55" r="16" fill="#FF8C00"/>
  <text x="40" y="60" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="sans-serif">☀</text>
  <text x="40" y="93" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Sunlight</text>
  <!-- → Panels -->
  <line x1="64" y1="55" x2="93" y2="55" stroke="#f7931e" stroke-width="2" marker-end="url(#ao)"/>
  <!-- PV Array -->
  <rect x="95" y="32" width="60" height="46" rx="3" fill="#1a5276" stroke="#2980b9" stroke-width="2"/>
  <line x1="95" y1="47" x2="155" y2="47" stroke="#2980b9" stroke-width="1"/>
  <line x1="95" y1="62" x2="155" y2="62" stroke="#2980b9" stroke-width="1"/>
  <line x1="115" y1="32" x2="115" y2="78" stroke="#2980b9" stroke-width="1"/>
  <line x1="135" y1="32" x2="135" y2="78" stroke="#2980b9" stroke-width="1"/>
  <text x="125" y="96" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">PV Array</text>
  <!-- → MPPT -->
  <line x1="155" y1="55" x2="178" y2="55" stroke="#f7931e" stroke-width="2" marker-end="url(#ao)"/>
  <!-- MPPT Controller -->
  <rect x="180" y="34" width="50" height="42" rx="4" fill="#8e44ad" stroke="#9b59b6" stroke-width="2"/>
  <text x="205" y="51" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">MPPT</text>
  <text x="205" y="65" text-anchor="middle" fill="white" font-size="8" font-family="sans-serif">Controller</text>
  <text x="205" y="96" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Charge Ctrl</text>
  <!-- → Battery -->
  <line x1="230" y1="55" x2="254" y2="55" stroke="#f7931e" stroke-width="2" marker-end="url(#ao)"/>
  <!-- Battery -->
  <rect x="256" y="34" width="52" height="42" rx="4" fill="#27ae60" stroke="#2ecc71" stroke-width="2"/>
  <rect x="305" y="44" width="8" height="22" rx="2" fill="#2ecc71"/>
  <text x="280" y="51" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">BATT</text>
  <text x="280" y="65" text-anchor="middle" fill="white" font-size="8" font-family="sans-serif">48V Bank</text>
  <text x="280" y="96" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Battery Bank</text>
  <!-- ↓ to Inverter -->
  <line x1="282" y1="76" x2="282" y2="116" stroke="#27ae60" stroke-width="2" marker-end="url(#ag)"/>
  <!-- Inverter -->
  <rect x="258" y="118" width="50" height="40" rx="4" fill="#c0392b" stroke="#e74c3c" stroke-width="2"/>
  <text x="283" y="134" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">INVERTER</text>
  <text x="283" y="147" text-anchor="middle" fill="white" font-size="8" font-family="sans-serif">DC → AC</text>
  <!-- → Load -->
  <line x1="258" y1="138" x2="217" y2="138" stroke="#e74c3c" stroke-width="2" marker-end="url(#ar)"/>
  <!-- House -->
  <polygon points="170,110 147,128 154,128 154,163 188,163 188,128 193,128" fill="#FF8C00" stroke="#e67e22" stroke-width="2"/>
  <rect x="158" y="140" width="13" height="23" fill="#8b4513"/>
  <text x="170" y="180" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Your Load</text>
  <text x="200" y="196" text-anchor="middle" fill="#aaa" font-size="8" font-family="sans-serif">⚡ Off-Grid: Solar Panels → MPPT → Battery → Inverter → Load</text>
</svg>`,

            hybrid: `<svg viewBox="0 0 440 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
  <defs>
    <marker id="ho" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#f7931e"/></marker>
    <marker id="hg" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#27ae60"/></marker>
    <marker id="hr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#e74c3c"/></marker>
    <marker id="hm" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#9b59b6"/></marker>
  </defs>
  <!-- Sun -->
  <circle cx="36" cy="52" r="22" fill="#FFD700" opacity="0.9"/>
  <circle cx="36" cy="52" r="15" fill="#FF8C00"/>
  <text x="36" y="57" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="sans-serif">☀</text>
  <text x="36" y="89" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Sunlight</text>
  <!-- → PV -->
  <line x1="58" y1="52" x2="85" y2="52" stroke="#f7931e" stroke-width="2" marker-end="url(#ho)"/>
  <!-- PV Array -->
  <rect x="87" y="29" width="58" height="46" rx="3" fill="#1a5276" stroke="#2980b9" stroke-width="2"/>
  <line x1="87" y1="44" x2="145" y2="44" stroke="#2980b9" stroke-width="1"/>
  <line x1="87" y1="59" x2="145" y2="59" stroke="#2980b9" stroke-width="1"/>
  <line x1="107" y1="29" x2="107" y2="75" stroke="#2980b9" stroke-width="1"/>
  <line x1="126" y1="29" x2="126" y2="75" stroke="#2980b9" stroke-width="1"/>
  <text x="116" y="93" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">PV Panels</text>
  <!-- → Hybrid Inv -->
  <line x1="145" y1="52" x2="167" y2="52" stroke="#f7931e" stroke-width="2" marker-end="url(#ho)"/>
  <!-- Hybrid Inverter -->
  <rect x="169" y="24" width="64" height="56" rx="5" fill="#8e44ad" stroke="#9b59b6" stroke-width="2"/>
  <text x="201" y="44" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">HYBRID</text>
  <text x="201" y="56" text-anchor="middle" fill="white" font-size="8" font-family="sans-serif">INVERTER</text>
  <text x="201" y="68" text-anchor="middle" fill="white" font-size="8" font-family="sans-serif">DC → AC</text>
  <text x="201" y="93" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Hybrid Inverter</text>
  <!-- ↓ to Battery -->
  <line x1="201" y1="80" x2="201" y2="116" stroke="#27ae60" stroke-width="2" marker-end="url(#hg)"/>
  <!-- Battery -->
  <rect x="174" y="118" width="56" height="40" rx="4" fill="#27ae60" stroke="#2ecc71" stroke-width="2"/>
  <rect x="227" y="128" width="8" height="20" rx="2" fill="#2ecc71"/>
  <text x="199" y="135" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">BATTERY</text>
  <text x="199" y="148" text-anchor="middle" fill="white" font-size="8" font-family="sans-serif">48V Bank</text>
  <text x="199" y="175" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Battery Bank</text>
  <!-- → Grid (dashed, bidirectional) -->
  <line x1="233" y1="52" x2="295" y2="52" stroke="#e74c3c" stroke-width="2" stroke-dasharray="5,3" marker-end="url(#hr)"/>
  <!-- Utility Grid -->
  <rect x="297" y="28" width="58" height="48" rx="4" fill="none" stroke="#e74c3c" stroke-width="2" stroke-dasharray="5,3"/>
  <text x="326" y="48" text-anchor="middle" fill="#e74c3c" font-size="9" font-weight="bold" font-family="sans-serif">UTILITY</text>
  <text x="326" y="61" text-anchor="middle" fill="#e74c3c" font-size="8" font-family="sans-serif">GRID</text>
  <text x="326" y="92" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Grid Backup</text>
  <!-- Grid → House -->
  <line x1="326" y1="76" x2="326" y2="127" stroke="#e74c3c" stroke-width="2" stroke-dasharray="4,2" marker-end="url(#hr)"/>
  <!-- Inv → House -->
  <line x1="233" y1="138" x2="292" y2="138" stroke="#9b59b6" stroke-width="2" marker-end="url(#hm)"/>
  <!-- House -->
  <polygon points="326,108 303,128 311,128 311,165 342,165 342,128 350,128" fill="#FF8C00" stroke="#e67e22" stroke-width="2"/>
  <rect x="315" y="140" width="13" height="25" fill="#8b4513"/>
  <text x="326" y="182" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Your Load</text>
  <text x="220" y="200" text-anchor="middle" fill="#aaa" font-size="8" font-family="sans-serif">⚡ Hybrid: PV → Hybrid Inverter ↔ Battery + Grid Backup → Load</text>
</svg>`,

            gridtied: `<svg viewBox="0 0 400 190" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
  <defs>
    <marker id="go" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#f7931e"/></marker>
    <marker id="gr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#e74c3c"/></marker>
  </defs>
  <!-- Sun -->
  <circle cx="38" cy="52" r="22" fill="#FFD700" opacity="0.9"/>
  <circle cx="38" cy="52" r="15" fill="#FF8C00"/>
  <text x="38" y="57" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="sans-serif">☀</text>
  <text x="38" y="90" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Sunlight</text>
  <!-- → PV -->
  <line x1="60" y1="52" x2="87" y2="52" stroke="#f7931e" stroke-width="2" marker-end="url(#go)"/>
  <!-- PV Array -->
  <rect x="89" y="29" width="58" height="46" rx="3" fill="#1a5276" stroke="#2980b9" stroke-width="2"/>
  <line x1="89" y1="44" x2="147" y2="44" stroke="#2980b9" stroke-width="1"/>
  <line x1="89" y1="59" x2="147" y2="59" stroke="#2980b9" stroke-width="1"/>
  <line x1="108" y1="29" x2="108" y2="75" stroke="#2980b9" stroke-width="1"/>
  <line x1="128" y1="29" x2="128" y2="75" stroke="#2980b9" stroke-width="1"/>
  <text x="118" y="93" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">PV Panels</text>
  <!-- → Grid-Tie Inv -->
  <line x1="147" y1="52" x2="168" y2="52" stroke="#f7931e" stroke-width="2" marker-end="url(#go)"/>
  <!-- Grid-Tie Inverter -->
  <rect x="170" y="28" width="60" height="48" rx="4" fill="#c0392b" stroke="#e74c3c" stroke-width="2"/>
  <text x="200" y="48" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">GRID-TIE</text>
  <text x="200" y="61" text-anchor="middle" fill="white" font-size="8" font-family="sans-serif">INVERTER</text>
  <text x="200" y="93" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Grid-Tie Inverter</text>
  <!-- → Net Meter -->
  <line x1="230" y1="52" x2="257" y2="52" stroke="#e74c3c" stroke-width="2" marker-end="url(#gr)"/>
  <!-- Net Meter -->
  <rect x="259" y="28" width="54" height="48" rx="4" fill="none" stroke="#e74c3c" stroke-width="2"/>
  <text x="286" y="48" text-anchor="middle" fill="#e74c3c" font-size="9" font-weight="bold" font-family="sans-serif">NET</text>
  <text x="286" y="61" text-anchor="middle" fill="#e74c3c" font-size="8" font-family="sans-serif">METER</text>
  <text x="286" y="93" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Net Metering</text>
  <!-- → Utility -->
  <line x1="313" y1="52" x2="348" y2="52" stroke="#e74c3c" stroke-width="2" stroke-dasharray="5,3" marker-end="url(#gr)"/>
  <!-- Utility Grid -->
  <rect x="350" y="34" width="44" height="36" rx="4" fill="none" stroke="#e74c3c" stroke-width="2" stroke-dasharray="4,2"/>
  <text x="372" y="54" text-anchor="middle" fill="#e74c3c" font-size="8" font-weight="bold" font-family="sans-serif">GRID</text>
  <!-- ↓ Inv to House -->
  <line x1="200" y1="76" x2="200" y2="118" stroke="#f7931e" stroke-width="2" marker-end="url(#go)"/>
  <!-- ↓ Meter to House -->
  <line x1="286" y1="76" x2="286" y2="118" stroke="#e74c3c" stroke-width="2" stroke-dasharray="4,2" marker-end="url(#gr)"/>
  <!-- Horizontal join line -->
  <line x1="200" y1="138" x2="266" y2="138" stroke="#f7931e" stroke-width="2"/>
  <line x1="286" y1="138" x2="266" y2="138" stroke="#e74c3c" stroke-width="2"/>
  <!-- House -->
  <polygon points="248,104 225,124 233,124 233,158 265,158 265,124 272,124" fill="#FF8C00" stroke="#e67e22" stroke-width="2"/>
  <rect x="237" y="135" width="12" height="23" fill="#8b4513"/>
  <text x="248" y="172" text-anchor="middle" fill="#555" font-size="9" font-family="sans-serif">Your Load</text>
  <text x="196" y="185" text-anchor="middle" fill="#aaa" font-size="8" font-family="sans-serif">⚡ Grid-Tied: PV → Grid-Tie Inverter → Net Meter ↔ Utility Grid + Load</text>
</svg>`
        };

        el.innerHTML = SVG[type] || SVG['hybrid'];
    }

    // ── Event listeners ─────────────────────────────────────────────────────
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeType = this.dataset.type;
            updateConfig();
        });
    });

    document.querySelectorAll('.sector-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sector-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeSector = this.dataset.sector;
            renderAppliances();
        });
    });

    renderAppliances();
}

console.log('Topshelf Solar Tech & Innovations - Website Loaded Successfully');
