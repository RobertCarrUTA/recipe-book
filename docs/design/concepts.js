import { formatServingsText } from '../../js/recipe_formatting.js';
const concept = new URL(location.href).searchParams.get('concept') === 'workbench' ? 'workbench' : 'notebook';
document.body.classList.add(concept);
document.querySelector('#conceptName').textContent = concept === 'notebook' ? 'Kitchen notebook' : 'Recipe workbench';
document.querySelector('#theme').addEventListener('click', (event) => {
  const dark = document.body.classList.toggle('dark');
  event.currentTarget.textContent = dark ? 'Switch to light' : 'Switch to dark';
});
const all = await fetch('../../data/recipes.json').then(response => response.json());
const ids = ['chicken-fried-steak','air-fryer-orange-chicken','beef-mushroom-barley-soup','banana-coffee-cake-pancakes','lemon-rosemary-chicken-white-bean-kale-soup','chicken-piccata','cinnamon-rolls','korean-bbq-galbi','garlic-mashed-potatoes'];
const recipes = ids.map(id => all.find(recipe => recipe.id === id)).filter(Boolean);
const node = (tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if(className) el.className = className; return el; };
function render(query = '') {
  const list = document.querySelector('#recipes'); list.replaceChildren();
  const matching = recipes.filter(recipe => JSON.stringify(recipe).toLowerCase().includes(query.toLowerCase()));
  for (const recipe of matching) {
    const card = node('article', '', 'recipe');
    card.append(node('p', recipe.category || recipe.collections?.[0]?.replaceAll('-', ' ') || 'Recipe', 'category'), node('h3', recipe.title), node('p', recipe.description, 'description'));
    const footer = node('footer', '');
    footer.append(node('span', recipe.totalTime || recipe.cookTime || 'At your pace'), node('span', formatServingsText(recipe.servings)), node('span', '↗'));
    card.append(footer); list.append(card);
  }
  document.querySelector('#count').textContent = query ? `${matching.length} in this study` : `${all.length} recipes`;
}
render();
document.querySelector('#search').addEventListener('input', event => render(event.target.value));
const featured = recipes[0];
document.querySelector('.reading-summary').textContent = featured.description;
for(const line of featured.ingredients) document.querySelector('#ingredients').append(node('li',line));
for(const line of featured.instructions) document.querySelector('#method').append(node('li',line));
