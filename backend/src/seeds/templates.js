const Template = require('../models/Template');

const defaultTemplates = [
  // IEEE SRS (Software Requirements Specification) Template
  {
    templateId: 'IEEE_SRS_V1',
    name: 'IEEE Software Requirements Specification',
    standard: 'IEEE-830',
    version: '1.0',
    description: 'Based on IEEE 830 standard for documenting software requirements. Ideal for academic projects and formal documentation.',
    metadata: {
      targetAudience: 'academic',
      language: 'en'
    },
    sections: [
      {
        id: 'introduction',
        number: '1',
        title: 'Introduction',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['introduction', 'overview', 'purpose', 'background'],
          codePatterns: ['README.md', 'package.json', 'pom.xml', 'build.gradle'],
          description: 'Project introduction, purpose, and high-level overview'
        },
        style: { tone: 'formal', format: 'prose', minLength: 100, maxLength: 300 }
      },
      {
        id: 'purpose',
        number: '1.1',
        title: 'Purpose',
        level: 2,
        required: true,
        parentId: 'introduction',
        aiHints: {
          keywords: ['purpose', 'goal', 'objective', 'aim'],
          codePatterns: ['README.md'],
          description: 'Specific purpose and goals of the software'
        },
        style: { tone: 'formal', format: 'prose', minLength: 50, maxLength: 200 }
      },
      {
        id: 'scope',
        number: '1.2',
        title: 'Scope',
        level: 2,
        required: true,
        parentId: 'introduction',
        aiHints: {
          keywords: ['scope', 'boundary', 'limitation', 'constraint'],
          codePatterns: ['README.md', '.gitignore'],
          description: 'Boundaries and limitations of the software'
        },
        style: { tone: 'formal', format: 'prose', minLength: 50, maxLength: 200 }
      },
      {
        id: 'definitions',
        number: '1.3',
        title: 'Definitions, Acronyms, and Abbreviations',
        level: 2,
        required: false,
        parentId: 'introduction',
        aiHints: {
          keywords: ['definition', 'acronym', 'terminology', 'glossary'],
          codePatterns: [],
          description: 'Technical terms and acronyms used in the project'
        },
        style: { tone: 'technical', format: 'bullets', minLength: 30, maxLength: 300 }
      },
      {
        id: 'overall-description',
        number: '2',
        title: 'Overall Description',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['architecture', 'overview', 'structure', 'design'],
          codePatterns: ['src/*', 'app/*', 'lib/*'],
          description: 'High-level system architecture and structure'
        },
        style: { tone: 'technical', format: 'prose', minLength: 100, maxLength: 400 }
      },
      {
        id: 'product-perspective',
        number: '2.1',
        title: 'Product Perspective',
        level: 2,
        required: true,
        parentId: 'overall-description',
        aiHints: {
          keywords: ['context', 'environment', 'integration', 'external'],
          codePatterns: ['docker-compose.yml', '.env.example', 'config/*'],
          description: 'How the product fits into larger systems'
        },
        style: { tone: 'technical', format: 'prose', minLength: 50, maxLength: 250 }
      },
      {
        id: 'product-functions',
        number: '2.2',
        title: 'Product Functions',
        level: 2,
        required: true,
        parentId: 'overall-description',
        aiHints: {
          keywords: ['function', 'feature', 'capability', 'functionality'],
          codePatterns: ['*/routes/*', '*/controllers/*', '*/api/*'],
          description: 'Main functions and features of the software'
        },
        style: { tone: 'technical', format: 'bullets', minLength: 100, maxLength: 400 }
      },
      {
        id: 'user-characteristics',
        number: '2.3',
        title: 'User Characteristics',
        level: 2,
        required: false,
        parentId: 'overall-description',
        aiHints: {
          keywords: ['user', 'role', 'persona', 'actor'],
          codePatterns: ['*/auth/*', '*/middleware/*', '*/roles/*'],
          description: 'Types of users and their characteristics'
        },
        style: { tone: 'formal', format: 'prose', minLength: 50, maxLength: 200 }
      },
      {
        id: 'constraints',
        number: '2.4',
        title: 'Constraints',
        level: 2,
        required: false,
        parentId: 'overall-description',
        aiHints: {
          keywords: ['constraint', 'limitation', 'restriction', 'requirement'],
          codePatterns: ['package.json', 'requirements.txt', 'Dockerfile'],
          description: 'Technical and business constraints'
        },
        style: { tone: 'technical', format: 'bullets', minLength: 30, maxLength: 200 }
      },
      {
        id: 'specific-requirements',
        number: '3',
        title: 'Specific Requirements',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['requirement', 'specification', 'feature', 'functionality'],
          codePatterns: ['*/features/*', '*/modules/*'],
          description: 'Detailed functional and non-functional requirements'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 150, maxLength: 500 }
      },
      {
        id: 'functional-requirements',
        number: '3.1',
        title: 'Functional Requirements',
        level: 2,
        required: true,
        parentId: 'specific-requirements',
        aiHints: {
          keywords: ['function', 'feature', 'api', 'endpoint', 'handler'],
          codePatterns: ['*/controllers/*', '*/handlers/*', '*/services/*'],
          description: 'What the system must do'
        },
        style: { tone: 'technical', format: 'bullets', minLength: 100, maxLength: 500 }
      },
      {
        id: 'non-functional-requirements',
        number: '3.2',
        title: 'Non-Functional Requirements',
        level: 2,
        required: false,
        parentId: 'specific-requirements',
        aiHints: {
          keywords: ['performance', 'security', 'reliability', 'scalability', 'usability'],
          codePatterns: ['*/middleware/*', '*/security/*', '*/config/*'],
          description: 'Quality attributes and constraints'
        },
        style: { tone: 'technical', format: 'bullets', minLength: 50, maxLength: 300 }
      },
      {
        id: 'external-interfaces',
        number: '3.3',
        title: 'External Interface Requirements',
        level: 2,
        required: false,
        parentId: 'specific-requirements',
        aiHints: {
          keywords: ['api', 'interface', 'integration', 'external', 'webhook'],
          codePatterns: ['*/api/*', '*/integrations/*', '*/webhooks/*'],
          description: 'Interfaces with external systems'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 50, maxLength: 300 }
      },
      {
        id: 'implementation',
        number: '4',
        title: 'Implementation Details',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['implementation', 'code', 'develop', 'build', 'create'],
          codePatterns: ['*.js', '*.ts', '*.py', '*.java', '*.go'],
          description: 'Technical implementation details and code explanations'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 100, maxLength: 500 }
      },
      {
        id: 'database-design',
        number: '4.1',
        title: 'Database Design',
        level: 2,
        required: false,
        parentId: 'implementation',
        aiHints: {
          keywords: ['database', 'schema', 'model', 'entity', 'table', 'collection'],
          codePatterns: ['*/models/*', '*/entities/*', '*/schemas/*', '*.prisma', 'migrations/*'],
          description: 'Database schema and data models'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 50, maxLength: 400 }
      },
      {
        id: 'api-endpoints',
        number: '4.2',
        title: 'API Endpoints',
        level: 2,
        required: false,
        parentId: 'implementation',
        aiHints: {
          keywords: ['route', 'endpoint', 'api', 'rest', 'graphql'],
          codePatterns: ['*/routes/*', '*/api/*', 'swagger.*', 'openapi.*'],
          description: 'API routes and endpoint documentation'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 50, maxLength: 400 }
      },
      {
        id: 'testing',
        number: '5',
        title: 'Testing',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['test', 'spec', 'coverage', 'unit', 'integration', 'e2e'],
          codePatterns: ['*.test.*', '*.spec.*', '__tests__/*', 'tests/*', 'test/*'],
          description: 'Testing strategies and test cases'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 50, maxLength: 400 }
      },
      {
        id: 'security',
        number: '6',
        title: 'Security Considerations',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['security', 'auth', 'authentication', 'authorization', 'jwt', 'encrypt', 'hash'],
          codePatterns: ['*/auth/*', '*/security/*', '*/middleware/auth*', '*jwt*', '*passport*'],
          description: 'Security measures and implementations'
        },
        style: { tone: 'formal', format: 'prose', minLength: 50, maxLength: 300 }
      },
      {
        id: 'conclusion',
        number: '7',
        title: 'Conclusion',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['conclusion', 'summary', 'future', 'next steps'],
          codePatterns: [],
          description: 'Project summary and future work'
        },
        style: { tone: 'formal', format: 'prose', minLength: 50, maxLength: 200 }
      },
      {
        id: 'references',
        number: '8',
        title: 'References',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['reference', 'citation', 'source', 'documentation'],
          codePatterns: ['package.json', 'requirements.txt', 'go.mod'],
          description: 'External references and dependencies'
        },
        style: { tone: 'formal', format: 'bullets', minLength: 20, maxLength: 200 }
      }
    ]
  },

  // IEEE SDD (Software Design Description) Template
  {
    templateId: 'IEEE_SDD_V1',
    name: 'IEEE Software Design Description',
    standard: 'IEEE-1016',
    version: '1.0',
    description: 'Based on IEEE 1016 standard for software design documentation. Focus on architecture and design decisions.',
    metadata: {
      targetAudience: 'professional',
      language: 'en'
    },
    sections: [
      {
        id: 'introduction',
        number: '1',
        title: 'Introduction',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['introduction', 'overview', 'purpose'],
          codePatterns: ['README.md'],
          description: 'Document introduction and purpose'
        },
        style: { tone: 'formal', format: 'prose', minLength: 100, maxLength: 300 }
      },
      {
        id: 'design-overview',
        number: '2',
        title: 'Design Overview',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['design', 'overview', 'architecture', 'approach'],
          codePatterns: ['src/*', 'app/*'],
          description: 'High-level design approach and philosophy'
        },
        style: { tone: 'technical', format: 'prose', minLength: 100, maxLength: 400 }
      },
      {
        id: 'system-architecture',
        number: '3',
        title: 'System Architecture',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['architecture', 'system', 'structure', 'layer', 'tier'],
          codePatterns: ['docker-compose.yml', 'src/*', 'packages/*'],
          description: 'Overall system architecture and layers'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 150, maxLength: 500 }
      },
      {
        id: 'context-viewpoint',
        number: '3.1',
        title: 'Context Viewpoint',
        level: 2,
        required: false,
        parentId: 'system-architecture',
        aiHints: {
          keywords: ['context', 'external', 'environment', 'integration'],
          codePatterns: ['docker-compose.yml', '.env.example'],
          description: 'System context and external interactions'
        },
        style: { tone: 'technical', format: 'prose', minLength: 50, maxLength: 300 }
      },
      {
        id: 'composition-viewpoint',
        number: '3.2',
        title: 'Composition Viewpoint',
        level: 2,
        required: false,
        parentId: 'system-architecture',
        aiHints: {
          keywords: ['component', 'module', 'package', 'composition'],
          codePatterns: ['*/components/*', '*/modules/*', 'packages/*'],
          description: 'System decomposition into components'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 100, maxLength: 400 }
      },
      {
        id: 'component-design',
        number: '4',
        title: 'Component Design',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['component', 'module', 'service', 'class'],
          codePatterns: ['*/services/*', '*/components/*', '*/modules/*'],
          description: 'Detailed component specifications'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 150, maxLength: 500 }
      },
      {
        id: 'data-design',
        number: '5',
        title: 'Data Design',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['data', 'database', 'schema', 'model', 'entity'],
          codePatterns: ['*/models/*', '*/entities/*', 'prisma/*', 'migrations/*'],
          description: 'Data structures and database design'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 100, maxLength: 400 }
      },
      {
        id: 'interface-design',
        number: '6',
        title: 'Interface Design',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['interface', 'api', 'contract', 'protocol'],
          codePatterns: ['*/routes/*', '*/api/*', '*/interfaces/*', 'types/*'],
          description: 'Internal and external interfaces'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 100, maxLength: 400 }
      },
      {
        id: 'detailed-design',
        number: '7',
        title: 'Detailed Design',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['algorithm', 'logic', 'flow', 'process', 'implementation'],
          codePatterns: ['*/utils/*', '*/helpers/*', '*/lib/*'],
          description: 'Algorithms and detailed logic'
        },
        style: { tone: 'technical', format: 'mixed', minLength: 100, maxLength: 500 }
      },
      {
        id: 'security-design',
        number: '8',
        title: 'Security Design',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['security', 'authentication', 'authorization', 'encryption'],
          codePatterns: ['*/auth/*', '*/security/*', '*/middleware/*'],
          description: 'Security architecture and measures'
        },
        style: { tone: 'technical', format: 'prose', minLength: 100, maxLength: 400 }
      }
    ]
  },

  // Agile Sprint Log Template
  {
    templateId: 'AGILE_LOG_V1',
    name: 'Agile Sprint Log',
    standard: 'AGILE',
    version: '1.0',
    description: 'Lightweight template for tracking sprint progress. Perfect for agile teams and quick project updates.',
    metadata: {
      targetAudience: 'internal',
      language: 'en'
    },
    sections: [
      {
        id: 'sprint-overview',
        number: '1',
        title: 'Sprint Overview',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['sprint', 'overview', 'goal', 'objective'],
          codePatterns: ['README.md', 'CHANGELOG.md'],
          description: 'Sprint goals and overall progress'
        },
        style: { tone: 'concise', format: 'prose', minLength: 50, maxLength: 200 }
      },
      {
        id: 'features-completed',
        number: '2',
        title: 'Features Completed',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['feature', 'add', 'implement', 'create', 'new', 'build'],
          codePatterns: ['*/features/*', '*/components/*', '*/pages/*'],
          description: 'New features and functionality added'
        },
        style: { tone: 'concise', format: 'bullets', minLength: 30, maxLength: 400 }
      },
      {
        id: 'bug-fixes',
        number: '3',
        title: 'Bug Fixes',
        level: 1,
        required: true,
        parentId: null,
        aiHints: {
          keywords: ['fix', 'bug', 'issue', 'error', 'patch', 'resolve', 'correct'],
          codePatterns: ['*.test.*', '*.spec.*'],
          description: 'Bugs fixed and issues resolved'
        },
        style: { tone: 'concise', format: 'bullets', minLength: 20, maxLength: 300 }
      },
      {
        id: 'improvements',
        number: '4',
        title: 'Improvements & Refactoring',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['refactor', 'improve', 'optimize', 'enhance', 'update', 'clean'],
          codePatterns: ['*/utils/*', '*/helpers/*', '*/lib/*'],
          description: 'Code improvements and refactoring'
        },
        style: { tone: 'concise', format: 'bullets', minLength: 20, maxLength: 300 }
      },
      {
        id: 'technical-debt',
        number: '5',
        title: 'Technical Debt',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['debt', 'todo', 'hack', 'workaround', 'temporary'],
          codePatterns: ['TODO', 'FIXME', 'HACK'],
          description: 'Known technical debt and shortcuts'
        },
        style: { tone: 'concise', format: 'bullets', minLength: 20, maxLength: 200 }
      },
      {
        id: 'dependencies',
        number: '6',
        title: 'Dependencies Updated',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['dependency', 'package', 'library', 'upgrade', 'update'],
          codePatterns: ['package.json', 'package-lock.json', 'yarn.lock', 'requirements.txt'],
          description: 'Dependency changes and updates'
        },
        style: { tone: 'concise', format: 'bullets', minLength: 20, maxLength: 200 }
      },
      {
        id: 'blockers',
        number: '7',
        title: 'Blockers & Challenges',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['block', 'challenge', 'issue', 'problem', 'stuck'],
          codePatterns: [],
          description: 'Current blockers and challenges faced'
        },
        style: { tone: 'concise', format: 'bullets', minLength: 20, maxLength: 200 }
      },
      {
        id: 'next-sprint',
        number: '8',
        title: 'Next Sprint',
        level: 1,
        required: false,
        parentId: null,
        aiHints: {
          keywords: ['next', 'plan', 'upcoming', 'future', 'todo'],
          codePatterns: [],
          description: 'Planned work for next sprint'
        },
        style: { tone: 'concise', format: 'bullets', minLength: 20, maxLength: 200 }
      }
    ]
  }
];

/**
 * Seeds the database with default templates if none exist
 * @returns {Promise<{seeded: boolean, count: number}>}
 */
async function seedTemplates() {
  try {
    const existingCount = await Template.countDocuments();
    
    if (existingCount > 0) {
      console.log(`📋 Templates already exist (${existingCount} found). Skipping seed.`);
      return { seeded: false, count: existingCount };
    }

    console.log('🌱 Seeding default templates...');
    
    const result = await Template.insertMany(defaultTemplates);
    
    console.log(`✅ Successfully seeded ${result.length} templates:`);
    result.forEach(t => console.log(`   - ${t.name} (${t.templateId})`));
    
    return { seeded: true, count: result.length };
  } catch (error) {
    console.error('❌ Error seeding templates:', error.message);
    throw error;
  }
}

/**
 * Get a template by its ID
 * @param {string} templateId 
 * @returns {Promise<Object>}
 */
async function getTemplateById(templateId) {
  return Template.findOne({ templateId }).lean();
}

/**
 * Get all available templates
 * @returns {Promise<Array>}
 */
async function getAllTemplates() {
  return Template.find({}).select('templateId name standard description').lean();
}

module.exports = {
  seedTemplates,
  getTemplateById,
  getAllTemplates,
  defaultTemplates
};
