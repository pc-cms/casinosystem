UPDATE auth.users
SET encrypted_password = crypt('Mwtbdltr!', gen_salt('bf')),
    updated_at = now()
WHERE id = 'bf328d89-bf0a-46ab-ae1e-9b4914cc9811';