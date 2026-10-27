// About Modal functionality
      document.addEventListener('DOMContentLoaded', function() {
        const aboutModal = document.getElementById('about-modal');
        const aboutBtn = document.getElementById('about-btn');
        const closeAboutModal = document.querySelector('.close-about-modal');
        
        // Show modal
        if (aboutBtn) {
          aboutBtn.addEventListener('click', () => {
            aboutModal.classList.add('active');
            aboutModal.setAttribute('aria-hidden', 'false');
            
            // Refresh iframe to ensure latest content
            const aboutIframe = document.getElementById('about-iframe');
            aboutIframe.src = aboutIframe.src;
          });
        }
        
        // Hide modal
        if (closeAboutModal) {
          closeAboutModal.addEventListener('click', () => {
            aboutModal.classList.remove('active');
            aboutModal.setAttribute('aria-hidden', 'true');
          });
        }
        
        // Hide modal when clicking outside
        window.addEventListener('click', (e) => {
          if (e.target === aboutModal) {
            aboutModal.classList.remove('active');
            aboutModal.setAttribute('aria-hidden', 'true');
          }
        });
        
        // Hide modal with Escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && aboutModal.classList.contains('active')) {
            aboutModal.classList.remove('active');
            aboutModal.setAttribute('aria-hidden', 'true');
          }
        });

        // Listen for messages from the iframe to close modal
        window.addEventListener('message', function(event) {
          if (event.data === 'closeAboutModal') {
            aboutModal.classList.remove('active');
            aboutModal.setAttribute('aria-hidden', 'true');
          }
        });
      });
