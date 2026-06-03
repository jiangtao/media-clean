import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const schemaPath = path.join(repoRoot, 'schemas', 'media-clean-result.schema.json');
const defaultFixturePath = path.join(repoRoot, 'fixtures', 'media-clean-result', 'golden-session.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function typeMatches(value, type) {
  if (Array.isArray(type)) {
    return type.some((item) => typeMatches(value, item));
  }

  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'null') return value === null;
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
}

function resolveRef(schema, ref) {
  const prefix = '#/$defs/';
  assert(ref.startsWith(prefix), `Unsupported $ref: ${ref}`);
  const key = ref.slice(prefix.length);
  const next = schema.$defs?.[key];
  assert(next, `Missing schema definition: ${key}`);
  return next;
}

function validateNode(rootSchema, nodeSchema, value, pointer = '$') {
  if (nodeSchema.$ref) {
    validateNode(rootSchema, resolveRef(rootSchema, nodeSchema.$ref), value, pointer);
    return;
  }

  if (nodeSchema.const !== undefined) {
    assert(value === nodeSchema.const, `${pointer} must equal ${JSON.stringify(nodeSchema.const)}`);
  }

  if (nodeSchema.type !== undefined) {
    assert(typeMatches(value, nodeSchema.type), `${pointer} has invalid type`);
  }

  if (nodeSchema.enum) {
    assert(nodeSchema.enum.includes(value), `${pointer} must be one of ${nodeSchema.enum.join(', ')}`);
  }

  if (typeof value === 'string' && nodeSchema.minLength !== undefined) {
    assert(value.length >= nodeSchema.minLength, `${pointer} is shorter than ${nodeSchema.minLength}`);
  }

  if (typeof value === 'number') {
    if (nodeSchema.minimum !== undefined) {
      assert(value >= nodeSchema.minimum, `${pointer} is below minimum ${nodeSchema.minimum}`);
    }
    if (nodeSchema.maximum !== undefined) {
      assert(value <= nodeSchema.maximum, `${pointer} is above maximum ${nodeSchema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (nodeSchema.minItems !== undefined) {
      assert(value.length >= nodeSchema.minItems, `${pointer} must have at least ${nodeSchema.minItems} item(s)`);
    }
    if (nodeSchema.items) {
      value.forEach((item, index) => validateNode(rootSchema, nodeSchema.items, item, `${pointer}[${index}]`));
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of nodeSchema.required ?? []) {
      assert(Object.hasOwn(value, key), `${pointer}.${key} is required`);
    }

    const properties = nodeSchema.properties ?? {};
    if (nodeSchema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        assert(Object.hasOwn(properties, key), `${pointer}.${key} is not allowed`);
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        validateNode(rootSchema, propertySchema, value[key], `${pointer}.${key}`);
      }
    }
  }
}

function validateCrossReferences(session) {
  const assetIds = new Set(session.assets.map((asset) => asset.id));
  const clusterIds = new Set(session.clusters.map((cluster) => cluster.id));
  const planIds = new Set(session.cleanupPlans.map((plan) => plan.id));

  for (const cluster of session.clusters) {
    assert(assetIds.has(cluster.representativeAssetId), `cluster ${cluster.id} has unknown representative asset`);
    for (const assetId of cluster.assetIds) {
      assert(assetIds.has(assetId), `cluster ${cluster.id} references unknown asset ${assetId}`);
    }
  }

  for (const review of session.llmReviews) {
    assert(clusterIds.has(review.clusterId), `llm review references unknown cluster ${review.clusterId}`);
  }

  for (const plan of session.cleanupPlans) {
    assert(clusterIds.has(plan.clusterId), `cleanup plan references unknown cluster ${plan.clusterId}`);
    for (const assetId of plan.assetIds) {
      assert(assetIds.has(assetId), `cleanup plan ${plan.id} references unknown asset ${assetId}`);
    }
  }

  for (const action of session.quarantineActions) {
    assert(planIds.has(action.planId), `quarantine action references unknown plan ${action.planId}`);
    for (const assetId of action.assetIds) {
      assert(assetIds.has(assetId), `quarantine action ${action.planId} references unknown asset ${assetId}`);
    }
  }
}

const schema = readJson(schemaPath);
const fixturePaths = process.argv.slice(2).map((input) => path.resolve(repoRoot, input));
if (!fixturePaths.length) {
  fixturePaths.push(defaultFixturePath);
}

assert(schema.$id?.endsWith('/media-clean-result.schema.json'), 'schema $id should name media-clean-result');
assert(schema.properties?.schemaVersion?.const === 'media-clean-result/v0.5', 'schema version const mismatch');

for (const fixturePath of fixturePaths) {
  const fixture = readJson(fixturePath);

  validateNode(schema, schema, fixture);
  validateCrossReferences(fixture);

  console.log(`media-clean-result schema fixture ok: ${path.relative(repoRoot, fixturePath)}`);
}
