export class File {
  uri: string;
  constructor(...uris: any[]) {
    this.uri = uris.join('/');
  }
  async base64() {
    return '';
  }
  async text() {
    return '';
  }
  write(_content: any, _options?: any) {}
  delete() {}
  get exists() {
    return false;
  }
}

export class Directory {
  uri: string;
  constructor(...uris: any[]) {
    this.uri = uris.join('/');
  }
  create(_options?: any) {}
  delete() {}
  get exists() {
    return false;
  }
}

export const Paths = {
  document: new Directory('file:///mock/documents'),
  cache: new Directory('file:///mock/cache'),
  bundle: new Directory('file:///mock/bundle'),
};
