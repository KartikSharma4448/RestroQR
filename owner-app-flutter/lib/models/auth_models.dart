class LoginRequest {
  final String? email;
  final String? phone;
  final String password;

  LoginRequest({this.email, this.phone, required this.password});

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{'password': password};
    if (email != null && email!.isNotEmpty) map['email'] = email;
    if (phone != null && phone!.isNotEmpty) map['phone'] = phone;
    return map;
  }
}

class RegisterRequest {
  final String name;
  final String? email;
  final String? phone;
  final String password;

  RegisterRequest({
    required this.name,
    this.email,
    this.phone,
    required this.password,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'name': name,
      'password': password,
    };
    if (email != null && email!.isNotEmpty) map['email'] = email;
    if (phone != null && phone!.isNotEmpty) map['phone'] = phone;
    return map;
  }
}

class AuthData {
  final String token;
  final UserData user;

  AuthData({required this.token, required this.user});

  factory AuthData.fromLoginJson(Map<String, dynamic> json) {
    return AuthData(
      token: json['token'] ?? '',
      user: UserData.fromJson(json['user'] as Map<String, dynamic>),
    );
  }

  factory AuthData.fromRegisterJson(Map<String, dynamic> json) {
    final owner = json['owner'] as Map<String, dynamic>;
    return AuthData(
      token: json['token'] ?? '',
      user: UserData(
        id: owner['id'] ?? '',
        name: owner['name'] ?? '',
        email: owner['email'],
        phone: owner['phone'],
        role: 'owner',
      ),
    );
  }
}

class UserData {
  final String id;
  final String? role;
  final String name;
  final String? email;
  final String? phone;

  UserData({
    required this.id,
    this.role,
    required this.name,
    this.email,
    this.phone,
  });

  factory UserData.fromJson(Map<String, dynamic> json) {
    return UserData(
      id: json['id'] ?? '',
      role: json['role'],
      name: json['name'] ?? '',
      email: json['email'],
      phone: json['phone'],
    );
  }
}
