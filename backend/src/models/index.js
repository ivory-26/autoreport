/**
 * Models Index
 * 
 * Central export point for all MongoDB models
 */

const Template = require('./Template');
const Project = require('./Project');
const Report = require('./Report');
const AutoLog = require('./AutoLog');

module.exports = {
  Template,
  Project,
  Report,
  AutoLog
};
