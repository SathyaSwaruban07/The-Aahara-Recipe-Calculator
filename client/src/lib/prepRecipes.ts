import type { Ingredient, Recipe, Unit } from "../types";

export type PrepTreeNode = {
  key: string;
  name: string;
  amount: number;
  unit: Unit;
  soak?: boolean;
  soakDuration?: number;
  soakUnit?: Ingredient["soakUnit"];
  isPrep: boolean;
  depth: number;
  children: PrepTreeNode[];
};

/** Recipe ids that are referenced as prep by at least one other recipe. */
export function collectPrepTargetIds(recipes: Recipe[]): Set<string> {
  const ids = new Set<string>();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      if (ing.prepRecipeId) ids.add(ing.prepRecipeId);
    }
  }
  return ids;
}

/** Explicit flag or already linked as someone's prep. */
export function isPrerequisiteRecipe(recipe: Recipe, prepTargetIds: Set<string>): boolean {
  return !!recipe.isPrerequisite || prepTargetIds.has(recipe.id);
}

export function prepLinksOf(recipe: Recipe): { prepRecipeId: string; name: string; amount: number }[] {
  return recipe.ingredients
    .filter((ing) => !!ing.prepRecipeId)
    .map((ing) => ({
      prepRecipeId: ing.prepRecipeId!,
      name: ing.name,
      amount: ing.amount,
    }));
}

function roundAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Build a nested ingredient tree. Prep lines expand into the child recipe's
 * ingredients scaled by (prep portions / child baseServings).
 */
export function buildPrepTree(
  recipe: Recipe,
  catalog: Map<string, Recipe>,
  options?: {
    /** Resolve display name for an ingredient on a given recipe */
    nameFor?: (owner: Recipe, ing: Ingredient) => string;
    stack?: string[];
  }
): PrepTreeNode[] {
  const nameFor = options?.nameFor ?? ((_owner: Recipe, ing: Ingredient) => ing.name);
  const stack = options?.stack ?? [];
  if (stack.includes(recipe.id)) return [];

  const nextStack = [...stack, recipe.id];
  const nodes: PrepTreeNode[] = [];

  for (const ing of recipe.ingredients) {
    const node: PrepTreeNode = {
      key: `${recipe.id}:${ing.id}`,
      name: nameFor(recipe, ing),
      amount: ing.amount,
      unit: ing.prepRecipeId ? "portions" : ing.unit,
      soak: ing.soak,
      soakDuration: ing.soakDuration,
      soakUnit: ing.soakUnit,
      isPrep: !!ing.prepRecipeId,
      depth: 0,
      children: [],
    };

    if (ing.prepRecipeId) {
      const child = catalog.get(ing.prepRecipeId);
      if (child && child.baseServings > 0) {
        const factor = ing.amount / child.baseServings;
        const nested = buildPrepTree(child, catalog, { nameFor, stack: nextStack });
        node.children = nested.map((n) => scaleTreeNode(n, factor, 1));
      }
    }

    nodes.push(node);
  }

  return nodes;
}

function scaleTreeNode(node: PrepTreeNode, factor: number, depth: number): PrepTreeNode {
  return {
    ...node,
    amount: roundAmount(node.amount * factor),
    depth,
    children: node.children.map((c) => scaleTreeNode(c, factor, depth + 1)),
  };
}

/** Flatten tree for speech / simple lists (depth-first). */
export function flattenPrepTree(nodes: PrepTreeNode[]): PrepTreeNode[] {
  const out: PrepTreeNode[] = [];
  const walk = (list: PrepTreeNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
