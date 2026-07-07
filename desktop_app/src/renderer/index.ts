import './style.css';

const root = document.createElement('main');
root.className = 'app';

const heading = document.createElement('h1');
heading.textContent = 'Vesper';

root.appendChild(heading);
document.body.appendChild(root);