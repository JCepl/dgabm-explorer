// Combined exploratory starting view. All weights remain one.
window.DGABM_PRESET = {
  name: 'Overall view',
  featureSet: 'default20',
  includeOutputs: true,
  excludedFeatures: ['management_included'],
  scope: 'all',
  k: 3,
  labels: [],
  rationale: 'Model descriptors and output indicators are considered together, with management excluded and unit weights. The three groups are exploratory; they are not independently established natural classes. Continuous fields remain available for sensitivity checks.'
};
