// export const environmentData = [
//   { id: 'developing', label: 'Developing' },
//   { id: 'testing', label: 'Testing' },
//   { id: 'production', label: 'Production' },
// ]


export const environmentData = {
  Developing: {
    status: 'Developing environment',
    summary: 'This is used for testing new features.',
    release: 'v1.0.0',
    featureCount: 5,
  },

  Testing: {
    status: 'Testing environment',
    summary: 'This is used before production deployment.',
    release: 'v1.0.0-rc',
    featureCount: 8,
  },

  Production: {
    status: 'Production environment',
    summary: 'This is the live application environment.',
    release: 'v1.0.0',
    featureCount: 12,
  },
}
