import React from 'react';

type RecipeCardProps = {
  image: string;
  title: string;
  description: string;
  ingredients: string[];
  cookTime: string;
  servings: number;
  author?: string;
  onViewRecipe: () => void;
};

const RecipeCard: React.FC<RecipeCardProps> = ({
  image,
  title,
  description,
  ingredients,
  cookTime,
  servings,
  author,
  onViewRecipe,
}) => (
  <div className="recipe-card">
    <img src={image} alt={title} className="recipe-image" />
    <h2>{title}</h2>
    <p>{description}</p>
    <div>
      <span>🕒 {cookTime}</span>
      <span>🍽️ {servings} servings</span>
    </div>
    <ul>
      {ingredients.slice(0, 3).map((ingredient, idx) => (
        <li key={idx}>{ingredient}</li>
      ))}
      {ingredients.length > 3 && <li>...and more</li>}
    </ul>
    {author && <p>By {author}</p>}
    <button onClick={onViewRecipe}>View Recipe</button>
  </div>
);

export default RecipeCard;