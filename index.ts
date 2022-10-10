const folder = Deno.args[0];

const filePaths: string[] = [];

const findFilesDeep = async (findFolder: string) => {
  const files = Deno.readDirSync(findFolder);

  for await (const file of files) {
    if (file.isFile) {
      if (
        file.name.endsWith(".ts") ||
        file.name.endsWith(".js") ||
        file.name.endsWith(".vue")
      ) {
        filePaths.push(`${findFolder}/${file.name}`);
      }
    } else {
      await findFilesDeep(`${findFolder}/${file.name}`);
    }
  }
};

await findFilesDeep(folder);

filePaths.forEach(async (filePath) => {
  const file = await Deno.readTextFile(filePath);

  const lines = file.split("\n");

  const matches = {
    notify: {
      match: /root\.\$notify/g,
      count: 0,
      to: "Notification",
    },
    router: {
      match: /root\.\$router/g,
      count: 0,
      to: "router",
    },
    route: {
      match: /root\.\$route/g,
      count: 0,
      to: "route",
    },
  };

  const convertLine = (line: string) => {
    Object.keys(matches).forEach((key) => {
      const selectedMatches = matches[key as keyof typeof matches];
      const match = selectedMatches.match.exec(line);
      if (match) selectedMatches.count++;
      line = line.replace(selectedMatches.match, selectedMatches.to);
    });
    return line;
  };

  const convertedLines = lines.map(convertLine);

  const scriptTagStartIndex = () =>
    convertedLines.findIndex((line) => line.match(/<script.*>/));
  const setupFunctionStartIndex = () =>
    convertedLines.findIndex((line) => line.match(/setup\(.*\)/));

  if (matches.notify.count > 0) {
    convertedLines.splice(
      scriptTagStartIndex() + 1,
      0,
      `import { Notification } from 'element-ui';`
    );
  }
  if (matches.router.count > 0 || matches.route.count > 0) {
    convertedLines.splice(
      scriptTagStartIndex() + 1,
      0,
      `import { useRoute, useRouter } from 'vue-router/composables';`
    );
  }
  if (matches.router.count > 0) {
    convertedLines.splice(
      setupFunctionStartIndex() + 1,
      0,
      `const router = useRouter();`
    );
  }
  if (matches.route.count > 0) {
    convertedLines.splice(
      setupFunctionStartIndex() + 1,
      0,
      `const route = useRoute();`
    );
  }

  const setupFormattedLines = convertedLines.map((line) => {
    if (line.match(/setup\(.*\)/)) {
      line = line.replace(/root,?/, "");
      line = line.replace(/{ +}/, "");
      line = line.replace(/, +\)/, ")");
      line = line.replace(/\(_\)/, "()");
    }
    return line;
  });

  const newFile = setupFormattedLines.join("\n");
  await Deno.writeTextFile(filePath, newFile);
});
