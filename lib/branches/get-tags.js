const {template, escapeRegExp} = require('lodash');
const semver = require('semver');
const pReduce = require('p-reduce');
const debug = require('debug')('semantic-release:get-tags');
const {getTags, getNote} = require('../../lib/git');

module.exports = async ({cwd, env, options: {tagFormat}}, branches) => {
  // Generate a regex to parse tags formatted with `tagFormat`
  // by replacing the `version` variable in the template by `(.+)`.
  // The `tagFormat` is compiled with space as the `version` as it's an invalid tag character,
  // so it's guaranteed to no be present in the `tagFormat`.

  // Trim-off everything after the ${version} in the tagFormat. eg) some-thing-${version}-amd64
  const tagFormatSimple = tagFormat.split('${version}')[0] + "${version}"
  const tagRegexp = `^${escapeRegExp(template(tagFormatSimple)({version: ' '})).replace(' ', '(.+)')}`;

  return pReduce(
    branches,
    async (branches, branch) => {
      const branchTags = await pReduce(
        await getTags(branch.name, {cwd, env}),
        async (branchTags, tag) => {
          const [, version] = tag.match(tagRegexp) || [];
          // Note arch must be be after version in the tagFormat
          const versionIgnoringArch = version && version.split('-')[0]
          return version && semver.valid(semver.clean(versionIgnoringArch))
            ? [...branchTags, {gitTag: tag, version: versionIgnoringArch, channels: (await getNote(tag, {cwd, env})).channels || [null]}]
            : branchTags;
        },
        []
      );

      debug('found tags for branch %s: %o', branch.name, branchTags);
      return [...branches, {...branch, tags: branchTags}];
    },
    []
  );
};
