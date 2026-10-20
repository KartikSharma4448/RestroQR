import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../ui/auth_layout.dart';

class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({super.key});
  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final _code = TextEditingController();
  final _form = GlobalKey<FormState>();
  int _resendSeconds = 60;
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_resendSeconds > 0) setState(() => _resendSeconds--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (!_form.currentState!.validate()) return;
    final auth = context.read<AuthService>();
    final success = await auth.verifySignupCode(_code.text);
    if (!mounted) return;
    if (success) context.go('/connect-google');
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return Scaffold(
      appBar: AppBar(title: const Text('Verify email')),
      body: AuthLayout(
        title: 'Verify your email',
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _code,
                decoration: const InputDecoration(
                  labelText: 'Six-digit code',
                  prefixIcon: Icon(Icons.password),
                ),
                keyboardType: TextInputType.number,
                maxLength: 6,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (value) =>
                    value?.length == 6 ? null : 'Enter the six-digit code',
                onFieldSubmitted: (_) {
                  if (!auth.isLoading) _verify();
                },
              ),
              if (auth.error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    auth.error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: auth.isLoading ? null : _verify,
                child: Text(auth.isLoading ? 'Verifying...' : 'Verify email'),
              ),
              TextButton(
                onPressed: auth.isLoading || _resendSeconds > 0
                    ? null
                    : () async {
                        final sent = await auth.resendSignupCode();
                        if (!mounted || !sent) return;
                        _code.clear();
                        setState(() => _resendSeconds = 60);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('New code sent')),
                          );
                        }
                      },
                child: Text(
                  _resendSeconds > 0
                      ? 'Resend in ${_resendSeconds}s'
                      : 'Resend code',
                ),
              ),
              TextButton(
                onPressed: auth.isLoading
                    ? null
                    : () => context.go('/register'),
                child: const Text('Change email'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
