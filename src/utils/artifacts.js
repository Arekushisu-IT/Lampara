/**
 * Readable artifact name derived from its Unity Resources path.
 *
 * quests.artifact_resource_path holds the prefab path the game loads, e.g.
 *   'Artifacts/PassageOfTheTabo/PassageOfTheTabo_Artifact'  ->  'Passage Of The Tabo'
 *   'Artifacts/PomegranateLamp/PomegranateLamp_WeddingGift_Artifact'
 *                                                          ->  'Pomegranate Lamp Wedding Gift'
 *
 * Names follow the prefab file name, so they read exactly as the prefabs are named
 * (e.g. 'QuillofRevolution' becomes 'Quillof Revolution'). Returns null for an empty path.
 */
function artifactNameFromPath(resourcePath) {
  if (typeof resourcePath !== 'string') return null;
  const fileName = resourcePath.split('/').pop().trim();
  if (!fileName) return null;

  const name = fileName
    .replace(/_Artifact$/i, '')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')      // camelCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')   // acronym followed by a word
    .replace(/\s+/g, ' ')
    .trim();

  return name || null;
}

module.exports = { artifactNameFromPath };
