document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('nav-active');
        });
        
        const navLinks = document.querySelectorAll('.nav-links a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    nav.classList.remove('nav-active');
                }
            });
        });
    }
    
    const yearElement = document.querySelector('.current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    const currentPage = location.pathname.split('/').pop();
    const navItems = document.querySelectorAll('.nav-links a');
    
    navItems.forEach(item => {
        const itemPage = item.getAttribute('href');
        if (currentPage === itemPage) {
            item.classList.add('active');
        }
    });

    // Проверка авторизации для защищённых страниц
    const protectedPages = ['user.html', 'admin.html'];
    if (protectedPages.includes(currentPage)) {
        const userData = JSON.parse(sessionStorage.getItem('user'));
        if (!userData) {
            window.location.href = 'account.html';
            return;
        }
        
        // Дополнительная проверка на админа для admin.html
        if (currentPage === 'admin.html' && !userData.is_admin) {
            window.location.href = 'user.html';
        }
    }

    // Обработка формы авторизации
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Здесь будет логика авторизации
            alert('Форма отправлена! В реальном приложении здесь будет запрос к серверу.');
        });
    }
});