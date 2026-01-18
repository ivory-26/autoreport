/**
 * Models Index
 * 
 * Central export point for all MongoDB models
 */

const Template = require('./Template');
const Project = require('./Project');
const Report = require('./Report');
const AutoLog = require('./AutoLog');
const Invitation = require('./Invitation');
const User = require('./User');
const { Job, JOB_STATUS } = require('./Job');

module.exports = {
  Template,
  Project,
  Report,
  AutoLog,
  Invitation,
  User,
  Job,
  JOB_STATUS
};
