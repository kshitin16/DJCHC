/// Contract 3 (Feed Data) — the public feed and the admin post CRUD.
///
/// Realizes: FR1.3 (public read), FR2.1-FR2.6 (admin manages posts), FR7.1
/// (Calendar reuses `listPosts` and filters to EVENT client-side).
library;

import '../models/post.dart';
import 'gateways.dart';
import 'documents/feed_documents.dart';
import 'service_parsing.dart';

class FeedService {
  FeedService(this._api);

  final ApiGateway _api;

  /// `listPosts` — the public, server-side age-out-filtered feed.
  ///
  /// Auth mode follows the per-call rule: the Identity Pool's guest role when
  /// signed out, the User Pool JWT when signed in. Both are accepted by the
  /// schema (`allow.guest()` + `allow.authenticated()`).
  Future<List<Post>> listPosts({required bool signedIn}) async {
    final data = await _api.query(
      document: listPostsDocument,
      field: 'listPosts',
      authMode: publicReadAuthMode(signedIn: signedIn),
    );
    return parseList(data, Post.fromJson, field: 'listPosts');
  }

  /// `listAllPostsForAdmin` — every non-deleted post, aged out included.
  Future<List<Post>> listAllForAdmin() async {
    final data = await _api.query(
      document: listAllPostsForAdminDocument,
      field: 'listAllPostsForAdmin',
      authMode: AuthMode.userPool,
    );
    return parseList(data, Post.fromJson, field: 'listAllPostsForAdmin');
  }

  /// `getPost(id)` — loads one post for the admin edit form. Returns `null`
  /// when the post does not exist (the schema's return type is nullable).
  Future<Post?> getPost(String id) async {
    final data = await _api.query(
      document: getPostDocument,
      field: 'getPost',
      authMode: AuthMode.userPool,
      variables: {'id': id},
    );
    if (data == null) return null;
    return parseObject(data, Post.fromJson, field: 'getPost');
  }

  /// `createPost(input)`.
  Future<Post> create(CreatePostInput input) async {
    final data = await _api.mutate(
      document: createPostDocument,
      field: 'createPost',
      authMode: AuthMode.userPool,
      variables: {'input': input.toJson()},
    );
    return parseObject(data, Post.fromJson, field: 'createPost');
  }

  /// `updatePost(id, input)` — sends only the fields the caller supplied.
  Future<Post> update(String id, UpdatePostInput input) async {
    final data = await _api.mutate(
      document: updatePostDocument,
      field: 'updatePost',
      authMode: AuthMode.userPool,
      variables: {'id': id, 'input': input.toJson()},
    );
    return parseObject(data, Post.fromJson, field: 'updatePost');
  }

  /// `deletePost(id)` — the soft delete (BR2.6); returns the deleted post.
  Future<Post> delete(String id) async {
    final data = await _api.mutate(
      document: deletePostDocument,
      field: 'deletePost',
      authMode: AuthMode.userPool,
      variables: {'id': id},
    );
    return parseObject(data, Post.fromJson, field: 'deletePost');
  }
}
