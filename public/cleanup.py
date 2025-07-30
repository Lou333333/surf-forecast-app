#!/usr/bin/env python3
import os
import shutil
import glob

def delete_problematic_files():
    """Delete files and folders that are causing Vercel deployment issues"""
    
    # Get current directory (should be your surf-app folder)
    current_dir = os.getcwd()
    print(f"Cleaning up in directory: {current_dir}")
    
    # Files and folders to delete
    items_to_delete = [
        # Vite-related files
        "vite.config.js",
        "vite.config.ts",
        "vite.config.mjs",
        
        # HTML files that shouldn't be in Next.js root
        "index.html",
        
        # Build directories
        ".next",
        "dist",
        "build",
        
        # Other problematic files
        ".vite",
        "vite.config.json"
    ]
    
    deleted_items = []
    
    for item in items_to_delete:
        item_path = os.path.join(current_dir, item)
        
        try:
            if os.path.isfile(item_path):
                os.remove(item_path)
                deleted_items.append(f"Deleted file: {item}")
                print(f"✅ Deleted file: {item}")
                
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
                deleted_items.append(f"Deleted folder: {item}")
                print(f"✅ Deleted folder: {item}")
                
        except FileNotFoundError:
            print(f"⚪ Not found: {item}")
        except PermissionError:
            print(f"❌ Permission denied: {item}")
        except Exception as e:
            print(f"❌ Error deleting {item}: {str(e)}")
    
    # Also look for any vite config files with different extensions
    vite_configs = glob.glob("vite.config.*")
    for config in vite_configs:
        try:
            os.remove(config)
            deleted_items.append(f"Deleted vite config: {config}")
            print(f"✅ Deleted vite config: {config}")
        except Exception as e:
            print(f"❌ Error deleting {config}: {str(e)}")
    
    print("\n" + "="*50)
    if deleted_items:
        print("🎉 CLEANUP COMPLETE!")
        print("Deleted items:")
        for item in deleted_items:
            print(f"  - {item}")
    else:
        print("✨ No problematic files found - your project is clean!")
    
    print("\n📝 Next steps:")
    print("1. Run: git add .")
    print("2. Run: git commit -m 'Remove problematic files'")
    print("3. Run: git push origin main")
    print("4. Check Vercel deployment")

if __name__ == "__main__":
    print("🧹 SURF APP CLEANUP SCRIPT")
    print("This will delete files causing Vercel deployment issues...")
    
    response = input("\nProceed with cleanup? (y/n): ").lower().strip()
    
    if response in ['y', 'yes']:
        delete_problematic_files()
    else:
        print("Cleanup cancelled.")